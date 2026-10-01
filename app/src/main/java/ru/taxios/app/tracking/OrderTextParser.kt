package ru.taxios.app.tracking

/** Извлекает цену, километры и минуты из произвольного текста уведомления. */
object OrderTextParser {
    data class Parsed(val price: Double?, val distanceKm: Double?, val durationMin: Int?) {
        val isEmpty: Boolean get() = price == null && distanceKm == null && durationMin == null
    }

    private val priceRegex = Regex("""(\d{1,3}(?:[\s\u00A0]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:₽|руб|р\.|р\b|RUB)""", RegexOption.IGNORE_CASE)
    private val kmRegex = Regex("""(\d+(?:[.,]\d+)?)\s*км""", RegexOption.IGNORE_CASE)
    private val hoursMinRegex = Regex("""(\d+)\s*ч(?:ас|\.)?\s*(\d+)?\s*(?:мин)?""", RegexOption.IGNORE_CASE)
    private val minRegex = Regex("""(\d+)\s*мин""", RegexOption.IGNORE_CASE)

    fun parse(text: String): Parsed {
        val price = priceRegex.find(text)?.let { m ->
            val whole = m.groupValues[1].replace(Regex("[\\s\u00A0]"), "")
            val frac = m.groupValues[2]
            (if (frac.isEmpty()) whole else "$whole.$frac").toDoubleOrNull()
        }
        val km = kmRegex.find(text)?.groupValues?.get(1)?.replace(',', '.')?.toDoubleOrNull()
        val minutes = hoursMinRegex.find(text)?.let { m ->
            val h = m.groupValues[1].toIntOrNull() ?: 0
            val mm = m.groupValues[2].toIntOrNull() ?: 0
            h * 60 + mm
        } ?: minRegex.find(text)?.groupValues?.get(1)?.toIntOrNull()
        return Parsed(price, km, minutes)
    }

    /** Метки экрана Яндекс Про, за которыми идёт стоимость именно этой поездки. */
    private val rideLabel = Regex("стоимость поездки", RegexOption.IGNORE_CASE)
    private val paidLabel = Regex("^(оплачено|получите наличными|оплата от пассажира)", RegexOption.IGNORE_CASE)
    private val timeLine = Regex("""^\d{1,2}:\d{2}$""")
    private val historyOrderLine = Regex("""^заказ\s""", RegexOption.IGNORE_CASE)

    enum class Screen { RIDE, PAID, HISTORY, OTHER }

    /** Строка истории заказов: время (минуты от полуночи) и стоимость. */
    data class HistoryEntry(val minuteOfDay: Int, val price: Double)

    data class ScreenInfo(val screen: Screen, val price: Double?, val history: List<HistoryEntry> = emptyList())

    /**
     * Распознаёт экран Яндекс Про по строкам. RIDE — пассажир в машине (есть «Стоимость поездки…»
     * и цена), PAID — экран после оплаты («Оплачено картой» / «Получите наличными» + цена),
     * HISTORY — список заказов за день («08:19 / Заказ … / 119,46 ₽»). Дневные итоги, бонусы
     * «Приоритет», платная подача «+50 ₽» и прочее — OTHER без цены.
     */
    fun classifyScreen(lines: List<String>): ScreenInfo {
        lines.forEachIndexed { i, line ->
            if (rideLabel.containsMatchIn(line)) {
                return ScreenInfo(Screen.RIDE, priceAfter(lines, i))
            }
        }
        lines.forEachIndexed { i, line ->
            if (paidLabel.containsMatchIn(line)) {
                priceAfter(lines, i)?.let { return ScreenInfo(Screen.PAID, it) }
            }
        }
        val history = parseHistory(lines)
        if (history.isNotEmpty()) return ScreenInfo(Screen.HISTORY, null, history)
        return ScreenInfo(Screen.OTHER, null)
    }

    fun parseHistory(lines: List<String>): List<HistoryEntry> {
        val out = mutableListOf<HistoryEntry>()
        var i = 0
        while (i + 2 < lines.size) {
            val t = lines[i].trim()
            if (timeLine.matches(t) && historyOrderLine.containsMatchIn(lines[i + 1].trim())) {
                val price = parse(lines[i + 2]).price
                val (h, m) = t.split(':').map { it.toInt() }
                if (price != null && h < 24 && m < 60) {
                    out += HistoryEntry(h * 60 + m, price)
                    i += 3
                    continue
                }
            }
            i++
        }
        return out
    }

    private fun priceAfter(lines: List<String>, index: Int): Double? =
        (index + 1..minOf(index + 3, lines.lastIndex)).firstNotNullOfOrNull { j ->
            val l = lines[j]
            if (l.trimStart().startsWith("+")) null else parse(l).price
        }

    /** Совместимость: цена поездки с экрана, если экран — поездка или оплата. */
    fun pickPrice(lines: List<String>): Double? = classifyScreen(lines).price
}
