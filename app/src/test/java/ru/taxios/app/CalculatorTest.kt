package ru.taxios.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.taxios.app.domain.Analytics
import ru.taxios.app.domain.Calculator
import ru.taxios.app.domain.CostSettings
import ru.taxios.app.domain.OrderInput
import ru.taxios.app.domain.ShiftInput
import java.time.LocalDateTime
import java.time.ZoneOffset

class CalculatorTest {
    private val s = CostSettings(
        fuelConsumptionL100 = 9.0, fuelPricePerL = 65.0, depreciationPerKm = 4.0,
        commissionPercent = 12.0, emptyReturnPercent = 50.0, targetHourlyNet = 400.0,
    )

    @Test
    fun `fuel cost matches example from spec`() {
        // 280 км, 9 л/100 км, 65 ₽ -> 1638 ₽
        assertEquals(1638.0, Calculator.fuelCost(280.0, s), 0.01)
        assertEquals(1120.0, Calculator.depreciation(280.0, s), 0.01)
        assertEquals(900.0, Calculator.commission(7500.0, s), 0.01)
    }

    @Test
    fun `shift summary aggregates costs and rate`() {
        val start = 0L
        val shift = ShiftInput(
            startTime = start, endTime = start + 14 * 3_600_000L, idleKm = 30.0, extraExpenses = 0.0,
            orders = listOf(OrderInput(start, 7500.0, 250.0, 600)),
        )
        val sum = Calculator.summarize(shift, s)
        assertEquals(7500.0, sum.gross, 0.01)
        assertEquals(280.0, sum.km, 0.01)
        assertEquals(7500.0 - 900.0 - 1638.0 - 1120.0, sum.net, 0.01)
        assertEquals(sum.net / 14.0, sum.netPerHour, 0.01)
        assertEquals(1, sum.orders)
    }

    @Test
    fun `evaluate order accounts for empty return`() {
        val e = Calculator.evaluateOrder(620.0, 14.0, 27.0, s)
        assertEquals(7.0, e.emptyKm, 0.01)
        assertEquals(21.0, e.totalKm, 0.01)
        assertEquals(40.5, e.totalMinutes, 0.01)
        val expectedNet = 620.0 - 74.4 - Calculator.fuelCost(21.0, s) - 84.0
        assertEquals(expectedNet, e.net, 0.01)
        assertEquals(Calculator.Verdict.TAKE, e.verdict)
    }

    @Test
    fun `cheap long order is rejected`() {
        val e = Calculator.evaluateOrder(150.0, 20.0, 40.0, s)
        assertEquals(Calculator.Verdict.SKIP, e.verdict)
    }

    @Test
    fun `maybe verdict between 70 and 100 percent of target`() {
        // Без холостого пробега: 300 ₽ за 40 мин -> ~(300-36)/40*60 = 396 ₽/час < 400, > 280
        val e = Calculator.evaluateOrder(300.0, 0.0, 40.0, s.copy(emptyReturnPercent = 0.0))
        assertEquals(Calculator.Verdict.MAYBE, e.verdict)
    }

    @Test
    fun `by hour buckets orders by start hour`() {
        val zone = ZoneOffset.UTC
        fun at(h: Int) = LocalDateTime.of(2026, 1, 5, h, 0).toInstant(zone).toEpochMilli()
        val orders = listOf(
            OrderInput(at(8), 600.0, 10.0, 30),
            OrderInput(at(8), 400.0, 5.0, 30),
            OrderInput(at(22), 200.0, 10.0, 60),
        )
        val hours = Analytics.byHour(orders, s, zone)
        assertEquals(2, hours[8].orders)
        assertEquals(60, hours[8].minutes)
        assertEquals(1, hours[22].orders)
        assertTrue(hours[8].netPerHour > hours[22].netPerHour)
        val best = Analytics.bestHourWindow(hours)
        assertTrue(best != null && 8 in best)
    }

    @Test
    fun `insights require minimum data`() {
        val list = Analytics.insights(emptyList(), s)
        assertEquals(1, list.size)
        assertTrue(list[0].startsWith("Накопите"))
    }

    @Test
    fun `insights produce weekday and evening conclusions`() {
        val zone = ZoneOffset.UTC
        fun day(d: Int, h: Int) = LocalDateTime.of(2026, 1, d, h, 0).toInstant(zone).toEpochMilli()
        // Понедельник 5 января: хорошая смена утром, вечером плохо
        val mon = ShiftInput(
            day(5, 7), day(5, 23), 20.0, 0.0,
            listOf(
                OrderInput(day(5, 7), 700.0, 10.0, 60), OrderInput(day(5, 8), 700.0, 10.0, 60),
                OrderInput(day(5, 9), 700.0, 10.0, 60), OrderInput(day(5, 21), 250.0, 10.0, 60),
                OrderInput(day(5, 22), 250.0, 10.0, 60),
            ),
        )
        // Вторник 6 января: короткая смена, слабая
        val tue = ShiftInput(
            day(6, 12), day(6, 16), 10.0, 0.0,
            listOf(OrderInput(day(6, 12), 300.0, 10.0, 60), OrderInput(day(6, 13), 300.0, 10.0, 60)),
        )
        val out = Analytics.insights(listOf(mon, tue), s, zone)
        assertTrue(out.any { it.contains("Лучшее время: 07:00–10:00") })
        assertTrue(out.any { it.startsWith("После 21:00 доход/час падает") })
        assertTrue(out.any { it.contains("Холостой пробег") })
    }
}
