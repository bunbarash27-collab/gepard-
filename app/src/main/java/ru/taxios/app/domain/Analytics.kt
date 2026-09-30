package ru.taxios.app.domain

import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

object Analytics {

    val ruLocale: Locale = Locale("ru", "RU")

    data class HourBucket(val hour: Int, val net: Double = 0.0, val minutes: Int = 0, val orders: Int = 0) {
        val netPerHour: Double get() = if (minutes > 0) net / minutes * 60.0 else 0.0
    }

    data class WeekdayBucket(val day: DayOfWeek, val net: Double = 0.0, val minutes: Int = 0, val shifts: Int = 0) {
        val netPerHour: Double get() = if (minutes > 0) net / minutes * 60.0 else 0.0
    }

    /** Чистый доход и занятое время по часам суток (по началу заказа). */
    fun byHour(orders: List<OrderInput>, s: CostSettings, zone: ZoneId = ZoneId.systemDefault()): List<HourBucket> {
        val buckets = Array(24) { HourBucket(it) }
        for (o in orders) {
            val hour = Instant.ofEpochMilli(o.timestamp).atZone(zone).hour
            val b = buckets[hour]
            buckets[hour] = b.copy(
                net = b.net + Calculator.orderNet(o.price, o.distanceKm, s),
                minutes = b.minutes + o.durationMin,
                orders = b.orders + 1,
            )
        }
        return buckets.toList()
    }

    fun byWeekday(shifts: List<ShiftInput>, s: CostSettings, zone: ZoneId = ZoneId.systemDefault()): List<WeekdayBucket> {
        val map = DayOfWeek.values().associateWith { WeekdayBucket(it) }.toMutableMap()
        for (sh in shifts) {
            val day = Instant.ofEpochMilli(sh.startTime).atZone(zone).dayOfWeek
            val sum = Calculator.summarize(sh, s)
            val b = map.getValue(day)
            map[day] = b.copy(net = b.net + sum.net, minutes = b.minutes + sum.minutes, shifts = b.shifts + 1)
        }
        return DayOfWeek.values().map { map.getValue(it) }
    }

    /** Лучшее непрерывное окно из [window] часов по доходу/час. */
    fun bestHourWindow(hours: List<HourBucket>, window: Int = 3): IntRange? {
        var best: IntRange? = null
        var bestRate = Double.NEGATIVE_INFINITY
        var bestMinutes = 0
        for (start in 0..(24 - window)) {
            val slice = hours.subList(start, start + window)
            val minutes = slice.sumOf { it.minutes }
            if (minutes < 60) continue
            val rate = slice.sumOf { it.net } / minutes * 60.0
            // При равной ставке предпочитаем окно с большим объёмом данных.
            if (rate > bestRate + 1e-6 || (abs(rate - bestRate) <= 1e-6 && minutes > bestMinutes)) {
                bestRate = rate
                bestMinutes = minutes
                best = start until (start + window)
            }
        }
        return best
    }

    fun insights(shifts: List<ShiftInput>, s: CostSettings, zone: ZoneId = ZoneId.systemDefault()): List<String> {
        val out = mutableListOf<String>()
        val orders = shifts.flatMap { it.orders }
        if (shifts.size < 2 || orders.size < 5) {
            out += "Накопите статистику: нужно минимум 2 смены и 5 заказов, чтобы появились выводы."
            return out
        }
        val total = Calculator.summarize(shifts, s)

        val weekdays = byWeekday(shifts, s, zone).filter { it.shifts > 0 && it.minutes > 0 }
        if (weekdays.size >= 2) {
            val best = weekdays.maxBy { it.netPerHour }
            val worst = weekdays.minBy { it.netPerHour }
            if (worst.netPerHour > 0 && best.day != worst.day) {
                val pct = ((best.netPerHour / worst.netPerHour - 1) * 100).roundToInt()
                out += "${dayName(best.day).replaceFirstChar { it.uppercase() }} у тебя на $pct% выгоднее, чем ${dayNameGenitive(worst.day)} " +
                    "(${fmt(best.netPerHour)} против ${fmt(worst.netPerHour)} ₽/час)."
            }
        }

        val hours = byHour(orders, s, zone)
        bestHourWindow(hours)?.let { r ->
            val slice = hours.subList(r.first, r.last + 1)
            val rate = slice.sumOf { it.net } / slice.sumOf { it.minutes } * 60.0
            out += "Лучшее время: ${"%02d:00".format(r.first)}–${"%02d:00".format(r.last + 1)} — ${fmt(rate)} ₽/час."
        }

        val evening = hours.filter { it.hour >= 21 }
        val day = hours.filter { it.hour < 21 }
        val evMin = evening.sumOf { it.minutes }
        val dayMin = day.sumOf { it.minutes }
        if (evMin >= 60 && dayMin >= 60) {
            val evRate = evening.sumOf { it.net } / evMin * 60.0
            val dayRate = day.sumOf { it.net } / dayMin * 60.0
            if (dayRate > 0) {
                val pct = ((evRate / dayRate - 1) * 100).roundToInt()
                if (abs(pct) >= 10) {
                    out += if (pct < 0) "После 21:00 доход/час падает на ${-pct}%."
                    else "После 21:00 доход/час выше на $pct%."
                }
            }
        }

        if (total.km > 0 && total.orders > 0) {
            val kmPerOrder = total.km / total.orders
            val costPerKm = Calculator.fuelCost(1.0, s) + Calculator.depreciation(1.0, s)
            out += "На один заказ приходится ${"%.1f".format(kmPerOrder)} км пробега — это примерно ${fmt(kmPerOrder * costPerKm)} ₽ расходов на заказ."
        }

        if (total.gross > 0) {
            val share = (total.expenses / total.gross * 100).roundToInt()
            out += "Расходы съедают $share% выручки: реально ты работаешь за ${fmt(total.netPerHour)} ₽/час."
        }
        return out
    }

    fun dayName(day: DayOfWeek): String = day.getDisplayName(TextStyle.FULL, ruLocale)

    private fun dayNameGenitive(day: DayOfWeek): String = when (day) {
        DayOfWeek.MONDAY -> "в понедельник"
        DayOfWeek.TUESDAY -> "во вторник"
        DayOfWeek.WEDNESDAY -> "в среду"
        DayOfWeek.THURSDAY -> "в четверг"
        DayOfWeek.FRIDAY -> "в пятницу"
        DayOfWeek.SATURDAY -> "в субботу"
        DayOfWeek.SUNDAY -> "в воскресенье"
    }

    private fun fmt(v: Double): String = java.text.NumberFormat.getIntegerInstance(ruLocale).format(v.roundToInt())
}
