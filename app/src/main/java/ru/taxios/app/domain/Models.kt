package ru.taxios.app.domain

/** Параметры затрат водителя, задаются в настройках. */
data class CostSettings(
    val fuelConsumptionL100: Double = 9.0,
    val fuelPricePerL: Double = 65.0,
    val depreciationPerKm: Double = 4.0,
    val commissionPercent: Double = 20.0,
    val emptyReturnPercent: Double = 50.0,
    val targetHourlyNet: Double = 400.0,
    val dailyGoalNet: Double = 5000.0,
    /** Автоматически вести смену по статусам уведомлений Яндекс Про. */
    val autoMode: Boolean = true,
)

data class OrderInput(
    val timestamp: Long,
    val price: Double,
    val distanceKm: Double,
    val durationMin: Int,
)

data class ShiftInput(
    val startTime: Long,
    val endTime: Long,
    val idleKm: Double,
    val extraExpenses: Double,
    val orders: List<OrderInput>,
    val pausedMinutes: Int = 0,
) {
    val minutes: Int get() = (((endTime - startTime) / 60_000L).toInt() - pausedMinutes).coerceAtLeast(0)
}

data class ShiftSummary(
    val gross: Double = 0.0,
    val commission: Double = 0.0,
    val fuel: Double = 0.0,
    val depreciation: Double = 0.0,
    val extra: Double = 0.0,
    val km: Double = 0.0,
    val idleKm: Double = 0.0,
    val minutes: Int = 0,
    val orders: Int = 0,
    val shifts: Int = 0,
) {
    val expenses: Double get() = commission + fuel + depreciation + extra
    val net: Double get() = gross - expenses
    val netPerHour: Double get() = if (minutes > 0) net / minutes * 60.0 else 0.0
    val avgOrder: Double get() = if (orders > 0) gross / orders else 0.0

    operator fun plus(o: ShiftSummary) = ShiftSummary(
        gross + o.gross, commission + o.commission, fuel + o.fuel, depreciation + o.depreciation,
        extra + o.extra, km + o.km, idleKm + o.idleKm, minutes + o.minutes, orders + o.orders, shifts + o.shifts,
    )
}
