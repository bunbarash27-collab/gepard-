package ru.taxios.app.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ShiftDao {
    @Query("SELECT * FROM shifts WHERE endTime IS NULL ORDER BY startTime DESC LIMIT 1")
    fun observeActive(): Flow<ShiftEntity?>

    @Query("SELECT * FROM shifts WHERE endTime IS NULL ORDER BY startTime DESC LIMIT 1")
    suspend fun getActive(): ShiftEntity?

    @Query("SELECT * FROM shifts WHERE id = :id")
    suspend fun getById(id: Long): ShiftEntity?

    // Общий пробег смены плюс пробег текущего заказа (для справки). На паузе не считаем.
    @Query(
        "UPDATE shifts SET trackedKm = trackedKm + :deltaKm, " +
            "activeOrderKm = activeOrderKm + CASE WHEN activeOrderStart IS NULL THEN 0 ELSE :deltaKm END " +
            "WHERE id = :id AND pausedSince IS NULL",
    )
    suspend fun addDistance(id: Long, deltaKm: Double)

    // Все изменения состояния смены — точечными UPDATE, чтобы сервисы не перетирали записи друг друга.
    @Query("UPDATE shifts SET activeOrderStart = :now, activeOrderKm = 0, lastSeenPrice = NULL, lastSeenPriceAt = NULL, rideSeenAt = NULL WHERE id = :id AND activeOrderStart IS NULL")
    suspend fun openOrder(id: Long, now: Long): Int

    @Query("UPDATE shifts SET activeOrderStart = NULL, activeOrderKm = 0, lastSeenPrice = NULL, lastSeenPriceAt = NULL, rideSeenAt = NULL WHERE id = :id")
    suspend fun clearOrder(id: Long)

    @Query("UPDATE shifts SET lastSeenPrice = :price, lastSeenPriceAt = :at, rideSeenAt = COALESCE(rideSeenAt, :at) WHERE id = :id")
    suspend fun setSeenPrice(id: Long, price: Double, at: Long)

    @Query("UPDATE shifts SET rideSeenAt = COALESCE(rideSeenAt, :at) WHERE id = :id")
    suspend fun markRideSeen(id: Long, at: Long)

    @Query("UPDATE shifts SET pausedSince = :now WHERE id = :id AND pausedSince IS NULL")
    suspend fun pause(id: Long, now: Long)

    @Query("UPDATE shifts SET pausedMinutes = pausedMinutes + (:now - pausedSince) / 60000, pausedSince = NULL WHERE id = :id AND pausedSince IS NOT NULL")
    suspend fun resume(id: Long, now: Long)

    @Query("UPDATE shifts SET manualKm = :manualKm WHERE id = :id")
    suspend fun setManualKm(id: Long, manualKm: Double?)

    @Query(
        "UPDATE shifts SET endTime = :now, manualKm = :manualKm, extraExpenses = :extra, " +
            "activeOrderStart = NULL, activeOrderKm = 0, lastSeenPrice = NULL, lastSeenPriceAt = NULL, rideSeenAt = NULL, " +
            "pausedMinutes = pausedMinutes + CASE WHEN pausedSince IS NULL THEN 0 ELSE (:now - pausedSince) / 60000 END, pausedSince = NULL " +
            "WHERE id = :id",
    )
    suspend fun close(id: Long, now: Long, manualKm: Double?, extra: Double)

    @Transaction
    @Query("SELECT * FROM shifts ORDER BY startTime DESC")
    fun observeAllWithOrders(): Flow<List<ShiftWithOrders>>

    @Insert
    suspend fun insert(shift: ShiftEntity): Long

    @Update
    suspend fun update(shift: ShiftEntity)

    @Delete
    suspend fun delete(shift: ShiftEntity)
}

@Dao
interface OrderDao {
    @Query("SELECT * FROM orders WHERE shiftId = :shiftId ORDER BY timestamp DESC")
    fun observeForShift(shiftId: Long): Flow<List<OrderEntity>>

    @Query("SELECT * FROM orders WHERE shiftId = :shiftId AND priceMissing = 1 ORDER BY timestamp DESC LIMIT 1")
    suspend fun latestMissingPrice(shiftId: Long): OrderEntity?

    @Query("SELECT * FROM orders WHERE priceMissing = 1 AND timestamp >= :since ORDER BY timestamp DESC")
    suspend fun missingPriceSince(since: Long): List<OrderEntity>

    @Query("UPDATE orders SET price = :price, priceMissing = 0 WHERE id = :id AND priceMissing = 1")
    suspend fun fillPrice(id: Long, price: Double): Int

    @Insert
    suspend fun insert(order: OrderEntity): Long

    @Update
    suspend fun update(order: OrderEntity)

    @Delete
    suspend fun delete(order: OrderEntity)
}

@Dao
interface TrackDao {
    @Insert
    suspend fun insert(point: TrackPointEntity)
}

@Dao
interface NotificationLogDao {
    @Query("SELECT * FROM notification_log ORDER BY timestamp DESC LIMIT 200")
    fun observeRecent(): Flow<List<NotificationLogEntity>>

    @Insert
    suspend fun insert(entry: NotificationLogEntity)

    @Query("DELETE FROM notification_log")
    suspend fun clear()

    @Query("DELETE FROM notification_log WHERE timestamp < :before")
    suspend fun deleteOlderThan(before: Long)
}
