package ru.taxios.app.ui

import ru.taxios.app.domain.Analytics
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.roundToLong

private val intFormat: NumberFormat = NumberFormat.getIntegerInstance(Analytics.ruLocale)
private val timeFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm", Analytics.ruLocale)
private val dateFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("EE, d MMM", Analytics.ruLocale)

fun Double.rub(): String = intFormat.format(this.roundToLong()) + " ₽"
fun Double.rubSigned(): String = (if (this < 0) "−" else "") + kotlin.math.abs(this).rub()
fun Double.km(): String = if (this % 1.0 == 0.0) "${this.toLong()} км" else String.format(Analytics.ruLocale, "%.1f км", this)
fun Int.hhmm(): String = "${this / 60}:${"%02d".format(this % 60)}"
fun Long.time(): String = Instant.ofEpochMilli(this).atZone(ZoneId.systemDefault()).format(timeFormat)
fun Long.date(): String = Instant.ofEpochMilli(this).atZone(ZoneId.systemDefault()).format(dateFormat)

fun String.parseNumber(): Double? = replace(',', '.').replace(" ", "").trim().toDoubleOrNull()
fun Double.edit(): String = if (this % 1.0 == 0.0) this.toLong().toString() else this.toString()
