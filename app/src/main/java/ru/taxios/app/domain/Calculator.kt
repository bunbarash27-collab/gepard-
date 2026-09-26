package ru.taxios.app.domain

object Calculator {

    fun fuelCost(km: Double, s: CostSettings): Double = km * s.fuelConsumptionL100 / 100.0 * s.fuelPricePerL

    fun depreciation(km: Double, s: CostSettings): Double = km * s.depreciationPerKm

    fun commission(gross: Double, s: CostSettings): Double = gross * s.commissionPercent / 100.0

    /** Чистый доход с заказа без учёта холостого пробега. */
    fun orderNet(price: Double, km: Double, s: CostSettings): Double =
        price - commission(price, s) - fuelCost(km, s) - depreciation(km, s)

    fun summarize(shift: ShiftInput, s: CostSettings): ShiftSummary {
        val gross = shift.orders.sumOf { it.price }
        val orderKm = shift.orders.sumOf { it.distanceKm }
        val totalKm = orderKm + shift.idleKm
        return ShiftSummary(
            gross = gross,
            commission = commission(gross, s),
            fuel = fuelCost(totalKm, s),
            depreciation = depreciation(totalKm, s),
            extra = shift.extraExpenses,
            km = totalKm,
            idleKm = shift.idleKm,
            minutes = shift.minutes,
            orders = shift.orders.size,
            shifts = 1,
        )
    }

    fun summarize(shifts: List<ShiftInput>, s: CostSettings): ShiftSummary =
        shifts.fold(ShiftSummary()) { acc, shift -> acc + summarize(shift, s) }

    enum class Verdict { TAKE, MAYBE, SKIP }

    data class OrderEvaluation(
        val price: Double,
        val tripKm: Double,
        val emptyKm: Double,
        val commission: Double,
        val fuel: Double,
        val depreciation: Double,
        val totalMinutes: Double,
        val verdict: Verdict,
    ) {
        val totalKm: Double get() = tripKm + emptyKm
        val net: Double get() = price - commission - fuel - depreciation
        val netPerHour: Double get() = if (totalMinutes > 0) net / totalMinutes * 60.0 else 0.0
    }

    /**
     * Оценка заказа «брать / не брать». Холостой возврат считается как доля
     * дистанции заказа (emptyReturnPercent) и такой же долей времени.
     */
    fun evaluateOrder(price: Double, km: Double, minutes: Double, s: CostSettings): OrderEvaluation {
        val emptyFactor = s.emptyReturnPercent / 100.0
        val emptyKm = km * emptyFactor
        val totalKm = km + emptyKm
        val totalMinutes = minutes * (1 + emptyFactor)
        val commission = commission(price, s)
        val fuel = fuelCost(totalKm, s)
        val dep = depreciation(totalKm, s)
        val net = price - commission - fuel - dep
        val perHour = if (totalMinutes > 0) net / totalMinutes * 60.0 else 0.0
        val verdict = when {
            net <= 0 -> Verdict.SKIP
            perHour >= s.targetHourlyNet -> Verdict.TAKE
            perHour >= s.targetHourlyNet * 0.7 -> Verdict.MAYBE
            else -> Verdict.SKIP
        }
        return OrderEvaluation(price, km, emptyKm, commission, fuel, dep, totalMinutes, verdict)
    }
}
