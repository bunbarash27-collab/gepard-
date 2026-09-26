package ru.taxios.app.data

import kotlinx.coroutines.flow.Flow
import ru.taxios.app.domain.CostSettings

class Repository(private val db: AppDatabase, private val settingsStore: SettingsStore) {
    val settings: Flow<CostSettings> get() = settingsStore.settings
    val shifts: Flow<List<ShiftWithOrders>> = db.shiftDao().observeAllWithOrders()
    val activeShift: Flow<ShiftEntity?> = db.shiftDao().observeActive()
    val notifications: Flow<List<NotificationLogEntity>> = db.notificationLogDao().observeRecent()

    fun ordersFor(shiftId: Long): Flow<List<OrderEntity>> = db.orderDao().observeForShift(shiftId)

    suspend fun getActiveShift(): ShiftEntity? = db.shiftDao().getActive()

    suspend fun startShift(): Long = db.shiftDao().insert(ShiftEntity(startTime = System.currentTimeMillis()))

    suspend fun endShift(shift: ShiftEntity, idleKm: Double, extraExpenses: Double) {
        val fresh = db.shiftDao().getById(shift.id) ?: shift
        db.shiftDao().update(
            fresh.copy(
                endTime = System.currentTimeMillis(), idleKm = idleKm, extraExpenses = extraExpenses,
                activeOrderStart = null, activeOrderKm = 0.0,
            ),
        )
    }

    suspend fun deleteShift(shift: ShiftEntity) = db.shiftDao().delete(shift)

    suspend fun addOrder(shiftId: Long, price: Double, km: Double, minutes: Int, timestamp: Long = System.currentTimeMillis(), auto: Boolean = false) =
        db.orderDao().insert(OrderEntity(shiftId = shiftId, timestamp = timestamp, price = price, distanceKm = km, durationMin = minutes, auto = auto))

    suspend fun startOrder(shiftId: Long) {
        val shift = db.shiftDao().getById(shiftId) ?: return
        db.shiftDao().update(shift.copy(activeOrderStart = System.currentTimeMillis(), activeOrderKm = 0.0))
    }

    /** Завершает GPS-заказ: км и минуты берутся из трекинга, вводится только цена. */
    suspend fun finishOrder(shiftId: Long, price: Double, kmOverride: Double? = null) {
        val shift = db.shiftDao().getById(shiftId) ?: return
        val start = shift.activeOrderStart ?: return
        val now = System.currentTimeMillis()
        val minutes = ((now - start) / 60_000L).toInt().coerceAtLeast(1)
        val km = kmOverride ?: shift.activeOrderKm
        db.orderDao().insert(OrderEntity(shiftId = shiftId, timestamp = start, price = price, distanceKm = km, durationMin = minutes, auto = true))
        db.shiftDao().update(shift.copy(activeOrderStart = null, activeOrderKm = 0.0))
    }

    suspend fun cancelOrder(shiftId: Long) {
        val shift = db.shiftDao().getById(shiftId) ?: return
        db.shiftDao().update(shift.copy(activeOrderStart = null, activeOrderKm = 0.0))
    }

    suspend fun addDistance(shiftId: Long, deltaKm: Double) = db.shiftDao().addDistance(shiftId, deltaKm)

    suspend fun addTrackPoint(point: TrackPointEntity) = db.trackDao().insert(point)

    suspend fun deleteOrder(order: OrderEntity) = db.orderDao().delete(order)

    suspend fun saveSettings(s: CostSettings) = settingsStore.save(s)

    suspend fun logNotification(entry: NotificationLogEntity) {
        db.notificationLogDao().insert(entry)
        db.notificationLogDao().deleteOlderThan(System.currentTimeMillis() - 14L * 86_400_000L)
    }

    suspend fun clearNotifications() = db.notificationLogDao().clear()
}
