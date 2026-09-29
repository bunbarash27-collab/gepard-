package ru.taxios.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.taxios.app.tracking.OrderTextParser

class OrderTextParserTest {
    @Test
    fun `parses price km and minutes`() {
        val p = OrderTextParser.parse("Новый заказ: 620 ₽ · 14 км · 27 мин")
        assertEquals(620.0, p.price!!, 0.01)
        assertEquals(14.0, p.distanceKm!!, 0.01)
        assertEquals(27, p.durationMin)
    }

    @Test
    fun `parses thousands with spaces and decimals`() {
        val p = OrderTextParser.parse("Стоимость 1 240,50 руб, 3,5 км, 1 ч 5 мин")
        assertEquals(1240.5, p.price!!, 0.01)
        assertEquals(3.5, p.distanceKm!!, 0.01)
        assertEquals(65, p.durationMin)
    }

    @Test
    fun `ignores text without numbers`() {
        val p = OrderTextParser.parse("Вы на линии")
        assertTrue(p.isEmpty)
        assertNull(p.price)
    }

    @Test
    fun `ride screen from real log`() {
        val lines = listOf("Б", "улица Ворошилова, 3", "09:45", "Оплата наличными", "Стоимость поездки с учетом пробок", "149 ₽", "Завершить")
        val info = OrderTextParser.classifyScreen(lines)
        assertEquals(OrderTextParser.Screen.RIDE, info.screen)
        assertEquals(149.0, info.price!!, 0.01)
    }

    @Test
    fun `paid screen and daily totals`() {
        val paid = OrderTextParser.classifyScreen(listOf("Оплачено картой", "250 ₽"))
        assertEquals(OrderTextParser.Screen.PAID, paid.screen)
        assertEquals(250.0, paid.price!!, 0.01)
        // Дневной итог и бонус «Приоритет» — не цена заказа.
        val totals = OrderTextParser.classifyScreen(listOf("Приоритет", "+49", "22 заказа", "3 479,93 ₽"))
        assertEquals(OrderTextParser.Screen.OTHER, totals.screen)
        assertNull(totals.price)
        // Экран подачи с платной подачей.
        val pickup = OrderTextParser.classifyScreen(listOf("А", "улица Чапаева, 174", "Б", "улица Лермонтова, 11/1", "Пассажир", "Платная подача", "+50 ₽"))
        assertEquals(OrderTextParser.Screen.OTHER, pickup.screen)
        assertNull(pickup.price)
    }
}
