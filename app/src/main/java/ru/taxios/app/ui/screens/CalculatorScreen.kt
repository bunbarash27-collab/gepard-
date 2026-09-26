package ru.taxios.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.taxios.app.domain.Calculator
import ru.taxios.app.ui.MainViewModel
import ru.taxios.app.ui.NumberField
import ru.taxios.app.ui.SectionCard
import ru.taxios.app.ui.StatRow
import ru.taxios.app.ui.km
import ru.taxios.app.ui.parseNumber
import ru.taxios.app.ui.rub
import ru.taxios.app.ui.rubSigned
import ru.taxios.app.ui.theme.Amber
import ru.taxios.app.ui.theme.Green
import ru.taxios.app.ui.theme.Red

@Composable
fun CalculatorScreen(vm: MainViewModel) {
    val s by vm.settings.collectAsStateWithLifecycle()
    var price by remember { mutableStateOf("") }
    var km by remember { mutableStateOf("") }
    var min by remember { mutableStateOf("") }
    val p = price.parseNumber()
    val k = km.parseNumber()
    val m = min.parseNumber()

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Брать / не брать заказ", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Введите параметры заказа. Учитываются комиссия, топливо, амортизация и холостой возврат (${s.emptyReturnPercent.toInt()}% дистанции).",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        NumberField(price, { price = it }, "Стоимость заказа", suffix = "₽")
        NumberField(km, { km = it }, "Расстояние", suffix = "км")
        NumberField(min, { min = it }, "Время в пути", suffix = "мин")

        if (p != null && k != null && m != null && p > 0 && m > 0) {
            val e = Calculator.evaluateOrder(p, k, m, s)
            val (title, color) = when (e.verdict) {
                Calculator.Verdict.TAKE -> "🟢 ВЫГОДНО — БРАТЬ" to Green
                Calculator.Verdict.MAYBE -> "🟡 НА ГРАНИ" to Amber
                Calculator.Verdict.SKIP -> "🔴 НЕВЫГОДНО" to Red
            }
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.15f)),
            ) {
                Column(Modifier.padding(16.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = color)
                    Text("Прогноз чистыми", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
                    Text(e.net.rub(), style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold, color = color)
                    Text("${e.netPerHour.rub()}/час при цели ${s.targetHourlyNet.rub()}/час", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            SectionCard("Расчёт") {
                StatRow("Стоимость", e.price.rub())
                StatRow("Комиссия ${s.commissionPercent.toInt()}%", (-e.commission).rubSigned(), valueColor = Red)
                StatRow("Топливо (${e.totalKm.km()})", (-e.fuel).rubSigned(), valueColor = Red)
                StatRow("Амортизация", (-e.depreciation).rubSigned(), valueColor = Red)
                HorizontalDivider()
                StatRow("Чистыми", e.net.rub(), emphasized = true, valueColor = color)
                StatRow("Холостой возврат", "${e.emptyKm.km()} · ${(e.totalMinutes - m).toInt()} мин", valueColor = MaterialTheme.colorScheme.onSurfaceVariant)
                StatRow("Всего времени", "${e.totalMinutes.toInt()} мин", valueColor = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            Text(
                "Пример: 620 ₽ → 14 км → 27 мин",
                color = Color.Gray,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}
