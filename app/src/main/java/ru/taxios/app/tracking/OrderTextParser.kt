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
}
