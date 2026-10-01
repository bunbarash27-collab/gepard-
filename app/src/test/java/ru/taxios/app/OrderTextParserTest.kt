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
        val cash = OrderTextParser.classifyScreen(listOf("Получите наличными", "154 ₽", "30 сентября — 6 октября", "+ 1 000 ₽"))
        assertEquals(OrderTextParser.Screen.PAID, cash.screen)
        assertEquals(154.0, cash.price!!, 0.01)
        // Дневной итог и бонус «Приоритет» — не цена заказа.
        val totals = OrderTextParser.classifyScreen(listOf("Приоритет", "+49", "22 заказа", "3 479,93 ₽"))
        assertEquals(OrderTextParser.Screen.OTHER, totals.screen)
        assertNull(totals.price)
        // Экран подачи с платной подачей.
        val pickup = OrderTextParser.classifyScreen(listOf("А", "улица Чапаева, 174", "Б", "улица Лермонтова, 11/1", "Пассажир", "Платная подача", "+50 ₽"))
        assertEquals(OrderTextParser.Screen.OTHER, pickup.screen)
        assertNull(pickup.price)
    }

    @Test
    fun `history screen from real log`() {
        val lines = listOf(
            "Детализация", "Сегодня · 7 заказов", " ", "1 070,83 ₽", "Сегодня", "Картой · 533 ₽", "Наличными · 722 ₽",
            "Комиссия сервиса · -133,97 ₽", "В счёт уплаты налога · -50,2 ₽",
            "08:30", "Заказ улица Чкалова, 1Б, подъезд 1", "131,4 ₽",
            "08:19", "Заказ Красноармейская улица, 88", "119,46 ₽",
            "08:08", "Заказ Парковый проспект, 5", "187,72 ₽",
        )
        val info = OrderTextParser.classifyScreen(lines)
        assertEquals(OrderTextParser.Screen.HISTORY, info.screen)
        assertEquals(3, info.history.size)
        assertEquals(8 * 60 + 19, info.history[1].minuteOfDay)
        assertEquals(119.46, info.history[1].price, 0.01)
    }
}
