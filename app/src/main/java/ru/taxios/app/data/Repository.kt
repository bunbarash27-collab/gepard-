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

    suspend fun addOrder(shiftId: Long, price: Double, km: Double, minutes: Int, timestamp: Long = System.currentTimeMillis(), auto: Boolean = false) =
        db.orderDao().insert(OrderEntity(shiftId = shiftId, timestamp = timestamp, price = price, distanceKm = km, durationMin = minutes, auto = auto))

    suspend fun startOrder(shiftId: Long) {
        val shift = db.shiftDao().getById(shiftId) ?: return
        if (shift.activeOrderStart != null) return
        db.shiftDao().update(shift.copy(activeOrderStart = System.currentTimeMillis(), activeOrderKm = 0.0))
    }

    /**
     * Завершает GPS-заказ: км и минуты берутся из трекинга. Если [price] не задана,
     * заказ сохраняется с пометкой «укажите сумму». Возвращает созданный заказ или null.
     */
    suspend fun finishOrder(shiftId: Long, price: Double?, kmOverride: Double? = null): OrderEntity? {
        val shift = db.shiftDao().getById(shiftId) ?: return null
        val start = shift.activeOrderStart ?: return null
        val now = System.currentTimeMillis()
        val minutes = ((now - start) / 60_000L).toInt().coerceAtLeast(1)
        val km = kmOverride ?: shift.activeOrderKm
        val order = OrderEntity(
            shiftId = shiftId, timestamp = start, price = price ?: 0.0, distanceKm = km, durationMin = minutes,
            auto = true, priceMissing = price == null,
        )
        val id = db.orderDao().insert(order)
        db.shiftDao().update(shift.copy(activeOrderStart = null, activeOrderKm = 0.0))
        return order.copy(id = id)
    }

    suspend fun cancelOrder(shiftId: Long) {
        val shift = db.shiftDao().getById(shiftId) ?: return
        db.shiftDao().update(shift.copy(activeOrderStart = null, activeOrderKm = 0.0))
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
}
