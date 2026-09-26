package ru.taxios.app.data

import kotlinx.coroutines.flow.Flow
import ru.taxios.app.domain.CostSettings

class Repository(private val db: AppDatabase, private val settingsStore: SettingsStore) {
    val settings: Flow<CostSettings> get() = settingsStore.settings
    val shifts: Flow<List<ShiftWithOrders>> = db.shiftDao().observeAllWithOrders()
    val activeShift: Flow<ShiftEntity?> = db.shiftDao().observeActive()

    fun ordersFor(shiftId: Long): Flow<List<OrderEntity>> = db.orderDao().observeForShift(shiftId)

    suspend fun startShift(): Long = db.shiftDao().insert(ShiftEntity(startTime = System.currentTimeMillis()))

    suspend fun endShift(shift: ShiftEntity, idleKm: Double, extraExpenses: Double) =
        db.shiftDao().update(shift.copy(endTime = System.currentTimeMillis(), idleKm = idleKm, extraExpenses = extraExpenses))

    suspend fun deleteShift(shift: ShiftEntity) = db.shiftDao().delete(shift)

    suspend fun addOrder(shiftId: Long, price: Double, km: Double, minutes: Int) =
        db.orderDao().insert(OrderEntity(shiftId = shiftId, timestamp = System.currentTimeMillis(), price = price, distanceKm = km, durationMin = minutes))

    suspend fun deleteOrder(order: OrderEntity) = db.orderDao().delete(order)

    suspend fun saveSettings(s: CostSettings) = settingsStore.save(s)
}
