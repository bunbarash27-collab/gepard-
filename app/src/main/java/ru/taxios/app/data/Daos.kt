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

    // Рабочий пробег — только А→Б (rideStart задан); подача и поиск заказа — холостой. На паузе не считаем.
    @Query(
        "UPDATE shifts SET trackedKm = trackedKm + :deltaKm, " +
            "activeOrderKm = activeOrderKm + CASE WHEN activeOrderStart IS NULL THEN 0 ELSE :deltaKm END, " +
            "rideKm = rideKm + CASE WHEN rideStart IS NULL THEN 0 ELSE :deltaKm END, " +
            "idleKm = idleKm + CASE WHEN rideStart IS NULL THEN :deltaKm ELSE 0 END " +
            "WHERE id = :id AND pausedSince IS NULL",
    )
    suspend fun addDistance(id: Long, deltaKm: Double)

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
