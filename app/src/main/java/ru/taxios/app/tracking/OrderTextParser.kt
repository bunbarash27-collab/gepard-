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
    private val paidLabel = Regex("^оплачено", RegexOption.IGNORE_CASE)

    enum class Screen { RIDE, PAID, OTHER }

    data class ScreenInfo(val screen: Screen, val price: Double?)

    /**
     * Распознаёт экран Яндекс Про по строкам. RIDE — пассажир в машине (есть «Стоимость поездки…»
     * и цена), PAID — экран после оплаты («Оплачено картой» + цена). Дневные итоги, бонусы
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
        return ScreenInfo(Screen.OTHER, null)
    }

    private fun priceAfter(lines: List<String>, index: Int): Double? =
        (index + 1..minOf(index + 3, lines.lastIndex)).firstNotNullOfOrNull { j ->
            val l = lines[j]
            if (l.trimStart().startsWith("+")) null else parse(l).price
        }

    /** Совместимость: цена поездки с экрана, если экран — поездка или оплата. */
    fun pickPrice(lines: List<String>): Double? = classifyScreen(lines).price
}
