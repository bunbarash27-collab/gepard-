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
}
