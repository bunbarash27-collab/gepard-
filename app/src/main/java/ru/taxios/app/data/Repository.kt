package ru.taxios.app.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import ru.taxios.app.domain.CostSettings
import ru.taxios.app.tracking.OrderTextParser
import java.time.Instant
import java.time.ZoneId
import kotlin.math.abs

class Repository(private val db: AppDatabase, private val settingsStore: SettingsStore) {
    val settings: Flow<CostSettings> get() = settingsStore.settings
    val shifts: Flow<List<ShiftWithOrders>> = db.shiftDao().observeAllWithOrders()
    val activeShift: Flow<ShiftEntity?> = db.shiftDao().observeActive()
    val notifications: Flow<List<NotificationLogEntity>> = db.notificationLogDao().observeRecent()

    fun ordersFor(shiftId: Long): Flow<List<OrderEntity>> = db.orderDao().observeForShift(shiftId)

    suspend fun getActiveShift(): ShiftEntity? = db.shiftDao().getActive()

    suspend fun currentSettings(): CostSettings = settingsStore.settings.first()

    suspend fun startShift(): Long = db.shiftDao().insert(ShiftEntity(startTime = System.currentTimeMillis()))

    /** Закрывает смену. [manualKm] — пробег по одометру, если водитель поправил GPS. */
    suspend fun endShift(shift: ShiftEntity, manualKm: Double?, extraExpenses: Double) =
        db.shiftDao().close(shift.id, System.currentTimeMillis(), manualKm, extraExpenses)

    suspend fun setShiftKm(shiftId: Long, manualKm: Double?) = db.shiftDao().setManualKm(shiftId, manualKm)

    suspend fun pauseShift(shiftId: Long) = db.shiftDao().pause(shiftId, System.currentTimeMillis())

    suspend fun resumeShift(shiftId: Long) = db.shiftDao().resume(shiftId, System.currentTimeMillis())

    suspend fun deleteShift(shift: ShiftEntity) = db.shiftDao().delete(shift)

    suspend fun addOrder(shiftId: Long, price: Double, km: Double, minutes: Int, timestamp: Long = System.currentTimeMillis(), auto: Boolean = false) {
        db.orderDao().insert(OrderEntity(shiftId = shiftId, timestamp = timestamp, price = price, distanceKm = km, durationMin = minutes, auto = auto))
    }

    suspend fun startOrder(shiftId: Long) {
        db.shiftDao().openOrder(shiftId, System.currentTimeMillis())
    }

    /**
     * Завершает заказ: минуты и км — от принятия до завершения (для справки, расходы считаются по пробегу смены).
     * Без [price] берётся стоимость с экрана Яндекс Про, иначе — пометка «укажите сумму».
     */
    suspend fun finishOrder(shiftId: Long, price: Double?, kmOverride: Double? = null): OrderEntity? {
        val shift = db.shiftDao().getById(shiftId) ?: return null
        val start = shift.activeOrderStart ?: return null
        val now = System.currentTimeMillis()
        val minutes = ((now - start) / 60_000L).toInt().coerceAtLeast(1)
        val km = kmOverride ?: shift.activeOrderKm
        val seen = shift.lastSeenPrice?.takeIf { (shift.lastSeenPriceAt ?: 0) >= start - OFFER_LOOKBACK_MS }
        val finalPrice = price ?: seen
        val order = OrderEntity(
            shiftId = shiftId, timestamp = start, price = finalPrice ?: 0.0, distanceKm = km, durationMin = minutes,
            auto = true, priceMissing = finalPrice == null,
        )
        val id = db.orderDao().insert(order)
        db.shiftDao().clearOrder(shiftId)
        return order.copy(id = id)
    }

    suspend fun cancelOrder(shiftId: Long) = db.shiftDao().clearOrder(shiftId)

    /** Экран поездки Яндекс Про («Стоимость поездки…»): отмечаем, что пассажир в машине, и запоминаем цену. */
    suspend fun onRideScreen(price: Double?, at: Long) {
        val shift = db.shiftDao().getActive() ?: return
        if (price != null) db.shiftDao().setSeenPrice(shift.id, price, at)
        else db.shiftDao().markRideSeen(shift.id, at)
    }

    /** Экран «Оплачено» / «Получите наличными» после поездки проставляет цену только что закрытому заказу. */
    suspend fun onPaidScreen(price: Double, at: Long) {
        val shift = db.shiftDao().getActive() ?: return
        if (shift.activeOrderStart != null) {
            db.shiftDao().setSeenPrice(shift.id, price, at)
            return
        }
        val missing = db.orderDao().latestMissingPrice(shift.id) ?: return
        val finishedAt = missing.timestamp + missing.durationMin * 60_000L
        if (at - finishedAt <= COMPLETION_WINDOW_MS) {
            db.orderDao().fillPrice(missing.id, price)
        }
    }

    /**
     * Экран «Детализация» Яндекс Про: список заказов за день со временем подачи и ценой.
     * Заполняет суммы заказов без цены за последние сутки, сопоставляя по времени.
     */
    suspend fun onHistoryScreen(entries: List<OrderTextParser.HistoryEntry>, at: Long): Int {
        val zone = ZoneId.systemDefault()
        val missing = db.orderDao().missingPriceSince(at - 24 * 3_600_000L)
        if (missing.isEmpty()) return 0
        val used = HashSet<Int>()
        var filled = 0
        for (order in missing) {
            val startMin = Instant.ofEpochMilli(order.timestamp).atZone(zone).let { it.hour * 60 + it.minute }
            val endMin = startMin + order.durationMin
            val match = entries.withIndex()
                .filter { it.index !in used && it.value.minuteOfDay in (startMin - HISTORY_TOLERANCE_MIN)..(endMin + HISTORY_TOLERANCE_MIN) }
                .minByOrNull { (_, e) -> if (e.minuteOfDay in startMin..endMin) 0 else minOf(abs(e.minuteOfDay - startMin), abs(e.minuteOfDay - endMin)) }
                ?: continue
            used += match.index
            filled += db.orderDao().fillPrice(order.id, match.value.price)
        }
        return filled
    }

    suspend fun addDistance(shiftId: Long, deltaKm: Double) = db.shiftDao().addDistance(shiftId, deltaKm)

    suspend fun addTrackPoint(point: TrackPointEntity) = db.trackDao().insert(point)

    suspend fun setOrderPrice(order: OrderEntity, price: Double, km: Double) =
        db.orderDao().update(order.copy(price = price, distanceKm = km, priceMissing = false))

    suspend fun deleteOrder(order: OrderEntity) = db.orderDao().delete(order)

    suspend fun saveSettings(s: CostSettings) = settingsStore.save(s)

    suspend fun logNotification(entry: NotificationLogEntity) {
        db.notificationLogDao().insert(entry)
        db.notificationLogDao().deleteOlderThan(System.currentTimeMillis() - 14L * 86_400_000L)
    }

    suspend fun clearNotifications() = db.notificationLogDao().clear()

    private companion object {
        /** Цена, увиденная незадолго до принятия заказа (карточка предложения), тоже подходит. */
        const val OFFER_LOOKBACK_MS = 3 * 60_000L
        /** Сколько ждём экран «Итого» после закрытия заказа. */
        const val COMPLETION_WINDOW_MS = 4 * 60_000L
        /** Допуск при сопоставлении заказа со строкой истории, минут. */
        const val HISTORY_TOLERANCE_MIN = 2
    }
}
