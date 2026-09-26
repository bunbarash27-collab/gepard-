package ru.taxios.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.taxios.app.data.ShiftWithOrders
import ru.taxios.app.data.toInput
import ru.taxios.app.domain.Analytics
import ru.taxios.app.domain.Calculator
import ru.taxios.app.domain.CostSettings
import ru.taxios.app.ui.MainViewModel
import ru.taxios.app.ui.SectionCard
import ru.taxios.app.ui.StatRow
import ru.taxios.app.ui.date
import ru.taxios.app.ui.hhmm
import ru.taxios.app.ui.km
import ru.taxios.app.ui.rub
import ru.taxios.app.ui.time

private enum class Period(val label: String, val days: Int?) {
    Week("7 дней", 7), Month("30 дней", 30), All("Всё время", null)
}

@Composable
fun StatsScreen(vm: MainViewModel) {
    val s by vm.settings.collectAsStateWithLifecycle()
    val all by vm.shifts.collectAsStateWithLifecycle()
    var period by remember { mutableStateOf(Period.Week) }

    val now = System.currentTimeMillis()
    val completed = all.filter { it.shift.endTime != null }
    val filtered = period.days?.let { d -> completed.filter { it.shift.startTime >= now - d * 86_400_000L } } ?: completed
    val inputs = filtered.map { it.toInput(now) }
    val total = Calculator.summarize(inputs, s)
    val hours = Analytics.byHour(inputs.flatMap { it.orders }, s)
    val insights = Analytics.insights(inputs, s)

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Period.values().forEach { p ->
                    FilterChip(selected = period == p, onClick = { period = p }, label = { Text(p.label) })
                }
            }
        }
        item {
            SectionCard("📊 Итоги · смен: ${total.shifts}") {
                StatRow("Выручка", total.gross.rub())
                StatRow("Чистыми", total.net.rub(), valueColor = MaterialTheme.colorScheme.primary, emphasized = true)
                StatRow("Расходы", total.expenses.rub())
                StatRow("Пробег", total.km.km())
                StatRow("Заказы", total.orders.toString())
                StatRow("Средний заказ", total.avgOrder.rub())
                StatRow("Время работы", total.minutes.hhmm())
                StatRow("Доход/час", "${total.netPerHour.rub()}/час", emphasized = true)
            }
        }
        item {
            SectionCard("🧠 Выводы") {
                insights.forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
            }
        }
        if (hours.any { it.orders > 0 }) {
            item { SectionCard("🕐 Доход/час по часам суток") { HourChart(hours) } }
        }
        if (filtered.isNotEmpty()) {
            item { Text("Смены", style = MaterialTheme.typography.titleMedium) }
            items(filtered, key = { it.shift.id }) { sw ->
                ShiftRow(sw, s, now, onDelete = { vm.deleteShift(sw.shift) })
            }
        } else {
            item {
                Text(
                    "Завершённых смен за период пока нет.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                )
            }
        }
    }
}

@Composable
private fun HourChart(hours: List<Analytics.HourBucket>) {
    val max = hours.maxOf { it.netPerHour }.coerceAtLeast(1.0)
    Row(Modifier.fillMaxWidth().height(120.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
        hours.forEach { h ->
            val frac = (h.netPerHour / max).coerceIn(0.0, 1.0).toFloat()
            Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.BottomCenter) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .fillMaxHeight(if (h.orders > 0) frac.coerceAtLeast(0.04f) else 0.02f)
                        .background(
                            if (h.orders > 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                            RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp),
                        ),
                )
            }
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        listOf("0", "6", "12", "18", "23").forEach { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
    val best = Analytics.bestHourWindow(hours)
    if (best != null) {
        Text(
            "Лучшее окно: ${"%02d:00".format(best.first)}–${"%02d:00".format(best.last + 1)}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

@Composable
private fun ShiftRow(sw: ShiftWithOrders, s: CostSettings, now: Long, onDelete: () -> Unit) {
    val sum = Calculator.summarize(sw.toInput(now), s)
    SectionCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    "${sw.shift.startTime.date()} · ${sw.shift.startTime.time()}–${(sw.shift.endTime ?: now).time()}",
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Чистыми ${sum.net.rub()} · ${sum.netPerHour.rub()}/час",
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    "Выручка ${sum.gross.rub()} · ${sum.orders} зак. · ${sum.km.km()} · ${sum.minutes.hhmm()}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, contentDescription = "Удалить смену") }
        }
    }
}
