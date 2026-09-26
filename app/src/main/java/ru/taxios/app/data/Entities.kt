package ru.taxios.app.data

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.Relation
import ru.taxios.app.domain.OrderInput
import ru.taxios.app.domain.ShiftInput

@Entity(tableName = "shifts")
data class ShiftEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val startTime: Long,
    val endTime: Long? = null,
    val idleKm: Double = 0.0,
    val extraExpenses: Double = 0.0,
)

@Entity(
    tableName = "orders",
    foreignKeys = [ForeignKey(
        entity = ShiftEntity::class,
        parentColumns = ["id"],
        childColumns = ["shiftId"],
        onDelete = ForeignKey.CASCADE,
    )],
    indices = [Index("shiftId")],
)
data class OrderEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val shiftId: Long,
    val timestamp: Long,
    val price: Double,
    val distanceKm: Double,
    val durationMin: Int,
)

data class ShiftWithOrders(
    @Embedded val shift: ShiftEntity,
    @Relation(parentColumn = "id", entityColumn = "shiftId") val orders: List<OrderEntity>,
)

fun OrderEntity.toInput() = OrderInput(timestamp, price, distanceKm, durationMin)

/** Незавершённая смена считается до [now]. */
fun ShiftWithOrders.toInput(now: Long) = ShiftInput(
    startTime = shift.startTime,
    endTime = shift.endTime ?: now,
    idleKm = shift.idleKm,
    extraExpenses = shift.extraExpenses,
    orders = orders.map { it.toInput() },
)
