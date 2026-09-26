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

    @Insert
    suspend fun insert(order: OrderEntity): Long

    @Delete
    suspend fun delete(order: OrderEntity)
}
