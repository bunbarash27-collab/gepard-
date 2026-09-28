package ru.taxios.app.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import ru.taxios.app.domain.CostSettings

class Repository(private val db: AppDatabase, private val settingsStore: SettingsStore) {
    val settings: Flow<CostSettings> get() = settingsStore.settings
    val shifts: Flow<List<ShiftWithOrders>> = db.shiftDao().observeAllWithOrders()
    val activeShift: Flow<ShiftEntity?> = db.shiftDao().observeActive()
    val notifications: Flow<List<NotificationLogEntity>> = db.notificationLogDao().observeRecent()

    fun ordersFor(shiftId: Long): Flow<List<OrderEntity>> = db.orderDao().observeForShift(shiftId)

    suspend fun getActiveShift(): ShiftEntity? = db.shiftDao().getActive()

    suspend fun currentSettings(): CostSettings = settingsStore.settings.first()

    suspend fun startShift(): Long = db.shiftDao().insert(ShiftEntity(startTime = System.currentTimeMillis()))

    suspend fun endShift(shift: ShiftEntity, idleKm: Double, extraExpenses: Double) {
        val fresh = db.shiftDao().getById(shift.id) ?: shift
        val now = System.currentTimeMillis()
        db.shiftDao().update(
            fresh.copy(
                endTime = now, idleKm = idleKm, extraExpenses = extraExpenses,
                activeOrderStart = null, activeOrderKm = 0.0,
                pausedSince = null, pausedMinutes = fresh.pausedMinutesAt(now),
            ),
        )
    }

    suspend fun pauseShift(shiftId: Long) {
        val shift = db.shiftDao().getById(shiftId) ?: return
        if (shift.pausedSince != null) return
        db.shiftDao().update(shift.copy(pausedSince = System.currentTimeMillis()))
    }

    suspend fun resumeShift(shiftId: Long) {
        val shift = db.shiftDao().getById(shiftId) ?: return
        val since = shift.pausedSince ?: return
        val minutes = ((System.currentTimeMillis() - since) / 60_000L).toInt()
        db.shiftDao().update(shift.copy(pausedSince = null, pausedMinutes = shift.pausedMinutes + minutes))
    }

    suspend fun deleteShift(shift: ShiftEntity) = db.shiftDao().delete(shift)

    suspend fun addOrder(shiftId: Long, price: Double, km: Double, minutes: Int, timestamp: Long = System.currentTimeMillis(), auto: Boolean = false) {
        db.orderDao().insert(OrderEntity(shiftId = shiftId, timestamp = timestamp, price = price, distanceKm = km, durationMin = minutes, auto = auto))
        // Ручной заказ во время GPS-смены: эти километры уже легли в холостой пробег.
        val shift = db.shiftDao().getById(shiftId) ?: return
        if (shift.trackedKm > 0) db.shiftDao().update(shift.copy(idleKm = (shift.idleKm - km).coerceAtLeast(0.0)))
    }

    suspend fun startOrder(shiftId: Long) {
        val shift = db.shiftDao().getById(shiftId) ?: return
        if (shift.activeOrderStart != null) return
        db.shiftDao().update(shift.copy(activeOrderStart = System.currentTimeMillis(), activeOrderKm = 0.0))
    }

    /**
     * Завершает GPS-заказ: км и минуты берутся из трекинга. Если [price] не задана, берётся
     * стоимость, увиденная на экране Яндекс Про во время заказа, иначе — пометка «укажите сумму».
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
        db.shiftDao().update(shift.copy(activeOrderStart = null, activeOrderKm = 0.0))
        return order.copy(id = id)
    }

    suspend fun cancelOrder(shiftId: Long) {
        val shift = db.shiftDao().getById(shiftId) ?: return
        // Километры отменённого заказа — холостые.
        db.shiftDao().update(shift.copy(activeOrderStart = null, activeOrderKm = 0.0, idleKm = shift.idleKm + shift.activeOrderKm))
    }

    /**
     * Стоимость с экрана Яндекс Про: запоминаем для текущего заказа, а если заказ
     * только что закрылся без суммы — проставляем ему (экран «Итого» появляется после поездки).
     */
    suspend fun recordScreenPrice(price: Double, at: Long) {
        val shift = db.shiftDao().getActive() ?: return
        if (shift.lastSeenPrice != price || shift.lastSeenPriceAt == null) {
            db.shiftDao().update(shift.copy(lastSeenPrice = price, lastSeenPriceAt = at))
        }
        if (shift.activeOrderStart == null) {
            val missing = db.orderDao().latestMissingPrice(shift.id) ?: return
            val finishedAt = missing.timestamp + missing.durationMin * 60_000L
            if (at - finishedAt <= COMPLETION_WINDOW_MS) {
                db.orderDao().update(missing.copy(price = price, priceMissing = false))
            }
        }
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
    }
}
