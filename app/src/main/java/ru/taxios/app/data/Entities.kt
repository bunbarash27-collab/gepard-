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
    /** Пробег по GPS за смену. */
    val trackedKm: Double = 0.0,
    /** Текущий заказ: начало и накопленный по GPS пробег. */
    val activeOrderStart: Long? = null,
    val activeOrderKm: Double = 0.0,
    /** Момент, когда пассажир сел (начало А→Б), и пробег с этого момента. */
    val rideStart: Long? = null,
    val rideKm: Double = 0.0,
    /** Пауза (обед и т.п.): начало текущей паузы и накопленные минуты завершённых пауз. */
    val pausedSince: Long? = null,
    val pausedMinutes: Int = 0,
    /** Последняя стоимость, увиденная на экране Яндекс Про, и когда. */
    val lastSeenPrice: Double? = null,
    val lastSeenPriceAt: Long? = null,
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
    val auto: Boolean = false,
    /** Заказ закрыт автоматически, сумма ещё не указана. */
    val priceMissing: Boolean = false,
    /** Подача: путь до точки А (считается холостым пробегом). */
    val pickupKm: Double = 0.0,
    val pickupMin: Int = 0,
)

@Entity(tableName = "track_points", indices = [Index("shiftId")])
data class TrackPointEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val shiftId: Long,
    val timestamp: Long,
    val lat: Double,
    val lon: Double,
    val inOrder: Boolean,
)

@Entity(tableName = "notification_log")
data class NotificationLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestamp: Long,
    val packageName: String,
    val title: String,
    val text: String,
    val price: Double? = null,
    val distanceKm: Double? = null,
    val durationMin: Int? = null,
)

data class ShiftWithOrders(
    @Embedded val shift: ShiftEntity,
    @Relation(parentColumn = "id", entityColumn = "shiftId") val orders: List<OrderEntity>,
)

/** Пробег без пассажира: копится по GPS, пока нет активного заказа, либо вводится вручную. */
fun ShiftWithOrders.effectiveIdleKm(): Double = shift.idleKm

fun OrderEntity.toInput() = OrderInput(timestamp, price, distanceKm, durationMin)

fun ShiftEntity.pausedMinutesAt(now: Long): Int =
    pausedMinutes + (pausedSince?.let { ((now - it) / 60_000L).toInt() } ?: 0)

/** Незавершённая смена считается до [now]. */
fun ShiftWithOrders.toInput(now: Long) = ShiftInput(
    startTime = shift.startTime,
    endTime = shift.endTime ?: now,
    idleKm = effectiveIdleKm(),
    extraExpenses = shift.extraExpenses,
    orders = orders.map { it.toInput() },
    pausedMinutes = if (shift.endTime == null) shift.pausedMinutesAt(now) else shift.pausedMinutes,
)
