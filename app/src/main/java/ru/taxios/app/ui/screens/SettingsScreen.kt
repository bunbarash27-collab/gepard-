package ru.taxios.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay
import ru.taxios.app.domain.CostSettings
import ru.taxios.app.ui.MainViewModel
import ru.taxios.app.ui.NumberField
import ru.taxios.app.ui.edit
import ru.taxios.app.ui.parseNumber
import ru.taxios.app.ui.theme.Green

@Composable
fun SettingsScreen(vm: MainViewModel) {
    val current by vm.settings.collectAsStateWithLifecycle()
    var loadedFrom by remember { mutableStateOf<CostSettings?>(null) }
    var consumption by remember { mutableStateOf("") }
    var fuelPrice by remember { mutableStateOf("") }
    var depreciation by remember { mutableStateOf("") }
    var commission by remember { mutableStateOf("") }
    var emptyReturn by remember { mutableStateOf("") }
    var targetHourly by remember { mutableStateOf("") }
    var dailyGoal by remember { mutableStateOf("") }
    var saved by remember { mutableStateOf(false) }

    // Заполняем поля один раз, когда настройки загрузились из DataStore.
    if (loadedFrom == null || (loadedFrom == CostSettings() && current != CostSettings())) {
        loadedFrom = current
        consumption = current.fuelConsumptionL100.edit()
        fuelPrice = current.fuelPricePerL.edit()
        depreciation = current.depreciationPerKm.edit()
        commission = current.commissionPercent.edit()
        emptyReturn = current.emptyReturnPercent.edit()
        targetHourly = current.targetHourlyNet.edit()
        dailyGoal = current.dailyGoalNet.edit()
    }

    val parsed = listOf(consumption, fuelPrice, depreciation, commission, emptyReturn, targetHourly, dailyGoal).map { it.parseNumber() }
    val valid = parsed.all { it != null && it >= 0 }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("Настройки", style = MaterialTheme.typography.headlineSmall)
        Text("Автомобиль", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
        NumberField(consumption, { consumption = it }, "Расход топлива", suffix = "л/100 км")
        NumberField(fuelPrice, { fuelPrice = it }, "Цена топлива", suffix = "₽/л")
        NumberField(depreciation, { depreciation = it }, "Амортизация", suffix = "₽/км", supporting = "Износ, ТО, шины, страховка. Обычно 3–6 ₽/км")

        Text("Работа", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
        NumberField(commission, { commission = it }, "Комиссия агрегатора и парка", suffix = "%")
        NumberField(emptyReturn, { emptyReturn = it }, "Холостой возврат после заказа", suffix = "%", supporting = "Какую часть дистанции заказа в среднем едете пустым обратно")
        NumberField(targetHourly, { targetHourly = it }, "Целевой доход в час (чистыми)", suffix = "₽/час", supporting = "Заказы ниже 70% этого значения — «невыгодно»")
        NumberField(dailyGoal, { dailyGoal = it }, "Цель дня (чистыми)", suffix = "₽")

        Button(
            enabled = valid,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            onClick = {
                val s = CostSettings(
                    fuelConsumptionL100 = parsed[0]!!, fuelPricePerL = parsed[1]!!, depreciationPerKm = parsed[2]!!,
                    commissionPercent = parsed[3]!!, emptyReturnPercent = parsed[4]!!,
                    targetHourlyNet = parsed[5]!!, dailyGoalNet = parsed[6]!!,
                )
                vm.saveSettings(s)
                loadedFrom = s
                saved = true
            },
        ) { Text("Сохранить") }
        if (saved) {
            Text("✅ Сохранено", color = Green)
            LaunchedEffect(Unit) { delay(2000); saved = false }
        }
    }
}
