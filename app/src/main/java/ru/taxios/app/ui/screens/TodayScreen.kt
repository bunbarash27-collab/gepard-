package ru.taxios.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.taxios.app.data.NotificationLogEntity
import ru.taxios.app.data.OrderEntity
import ru.taxios.app.domain.Calculator
import ru.taxios.app.domain.CostSettings
import ru.taxios.app.tracking.TaxiNotificationListener
import ru.taxios.app.ui.MainViewModel
import ru.taxios.app.ui.NumberField
import ru.taxios.app.ui.SectionCard
import ru.taxios.app.ui.StatRow
import ru.taxios.app.ui.edit
import ru.taxios.app.ui.hhmm
import ru.taxios.app.ui.km
import ru.taxios.app.ui.parseNumber
import ru.taxios.app.ui.rub
import ru.taxios.app.ui.rubSigned
import ru.taxios.app.ui.theme.Amber
import ru.taxios.app.ui.theme.Green
import ru.taxios.app.ui.theme.Red
import ru.taxios.app.ui.time

@Composable
fun TodayScreen(vm: MainViewModel) {
    val state by vm.today.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showAddOrder by remember { mutableStateOf(false) }
    var showFinishOrder by remember { mutableStateOf(false) }
    var showEndShift by remember { mutableStateOf(false) }
    var listenerEnabled by remember { mutableStateOf(TaxiNotificationListener.isEnabled(context)) }
    val sum = state.summary
    val s = state.settings
    val active = state.activeShift

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        listenerEnabled = TaxiNotificationListener.isEnabled(context)
        vm.ensureTracking()
    }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { vm.startShift() }
    val requiredPermissions = remember {
        buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
        }.toTypedArray()
    }
    fun startShiftWithPermissions() {
        val missing = requiredPermissions.filter { ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) vm.startShift() else permissionLauncher.launch(missing.toTypedArray())
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            SectionCard("🚕 Смена") {
                if (active == null) {
                    Text("Смена не начата. Пробег и время считаются автоматически по GPS.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Button(onClick = { startShiftWithPermissions() }, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Начать смену", style = MaterialTheme.typography.titleMedium) }
                } else {
                    Text("С ${active.startTime.time()} · ${state.activeMinutes.hhmm()} · GPS ${active.trackedKm.km()} · заказов: ${state.activeOrders.size}")
                    if (active.activeOrderStart == null) {
                        Button(
                            onClick = { vm.startOrder() },
                            modifier = Modifier.fillMaxWidth().height(64.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Green, contentColor = MaterialTheme.colorScheme.onPrimary),
                        ) { Text("▶ Заказ начался", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    } else {
                        Text(
                            "Заказ идёт: ${state.activeOrderMinutes} мин · ${active.activeOrderKm.km()}",
                            color = Green, fontWeight = FontWeight.Bold,
                        )
                        Button(
                            onClick = { showFinishOrder = true },
                            modifier = Modifier.fillMaxWidth().height(64.dp),
                        ) { Text("■ Заказ завершён", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                        TextButton(onClick = { vm.cancelOrder() }, modifier = Modifier.fillMaxWidth()) { Text("Отменить заказ", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { showAddOrder = true }, modifier = Modifier.weight(1f)) {
                            Icon(Icons.Default.Add, contentDescription = null)
                            Spacer(Modifier.width(4.dp))
                            Text("Вручную")
                        }
                        OutlinedButton(onClick = { showEndShift = true }, modifier = Modifier.weight(1f)) { Text("Завершить смену") }
                    }
                }
            }
        }
        state.suggestion?.let { n ->
            item { SuggestionCard(n, s) }
        }
        if (!listenerEnabled) {
            item {
                SectionCard {
                    Text("🔔 Подхватывать заказы из Яндекс Про", fontWeight = FontWeight.Bold)
                    Text(
                        "Разрешите чтение уведомлений — суммы заказов будут подставляться сами.",
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    OutlinedButton(onClick = { TaxiNotificationListener.openSettings(context) }, modifier = Modifier.fillMaxWidth()) { Text("Разрешить") }
                }
            }
        }
        item {
            SectionCard("Сегодня") {
                StatRow("💰 Выручка", sum.gross.rub())
                StatRow("⛽ Расходы", sum.expenses.rubSigned(), valueColor = MaterialTheme.colorScheme.onSurfaceVariant)
                StatRow("💵 Чистыми", sum.net.rub(), valueColor = MaterialTheme.colorScheme.primary, emphasized = true)
                StatRow("⏱ Работа", sum.minutes.hhmm())
                StatRow("🚗 Пробег", "${sum.km.km()} (пустой ${sum.idleKm.km()})")
                HorizontalDivider(Modifier.padding(vertical = 4.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("📈 Доход/час", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "${sum.netPerHour.rub()}/час",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
        item {
            val goal = s.dailyGoalNet
            val progress = if (goal > 0) (sum.net / goal).coerceIn(0.0, 1.0) else 0.0
            SectionCard("🎯 Цель дня") {
                Text("${goal.rub()} чистыми", style = MaterialTheme.typography.bodyLarge)
                LinearProgressIndicator(progress = { progress.toFloat() }, modifier = Modifier.fillMaxWidth().height(10.dp))
                val remaining = goal - sum.net
                if (remaining > 0) {
                    StatRow("${(progress * 100).toInt()}%", "Осталось: ${remaining.rub()}")
                } else {
                    Text("✅ Цель достигнута! Сверх цели: ${(-remaining).rub()}", color = Green, fontWeight = FontWeight.Bold)
                }
            }
        }
        if (state.activeOrders.isNotEmpty()) {
            item { Text("Заказы смены", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 4.dp)) }
            items(state.activeOrders, key = { it.id }) { order ->
                OrderRow(order, s, onDelete = { vm.deleteOrder(order) })
            }
        }
    }

    if (showAddOrder) {
        AddOrderDialog(s, onDismiss = { showAddOrder = false }) { price, km, min ->
            vm.addOrder(price, km, min)
            showAddOrder = false
        }
    }
    if (showFinishOrder && active != null) {
        FinishOrderDialog(
            trackedKm = active.activeOrderKm,
            minutes = state.activeOrderMinutes,
            suggestedPrice = state.suggestion?.price,
            settings = s,
            onDismiss = { showFinishOrder = false },
        ) { price, km ->
            vm.finishOrder(price, km)
            showFinishOrder = false
        }
    }
    if (showEndShift) {
        val trackedIdle = active?.let { (it.trackedKm - state.activeOrders.sumOf { o -> o.distanceKm }).coerceAtLeast(0.0) } ?: 0.0
        EndShiftDialog(trackedIdle = if (active != null && active.trackedKm > 0) trackedIdle else null, onDismiss = { showEndShift = false }) { idle, extra ->
            vm.endShift(idle, extra)
            showEndShift = false
        }
    }
}

@Composable
private fun SuggestionCard(n: NotificationLogEntity, s: CostSettings) {
    val price = n.price ?: return
    val km = n.distanceKm
    val min = n.durationMin
    SectionCard("🔔 Из Яндекс Про · ${n.timestamp.time()}") {
        Text(listOfNotNull(price.rub(), km?.km(), min?.let { "$it мин" }).joinToString(" · "), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        if (km != null && min != null) {
            val e = Calculator.evaluateOrder(price, km, min.toDouble(), s)
            val (label, color) = when (e.verdict) {
                Calculator.Verdict.TAKE -> "🟢 БРАТЬ" to Green
                Calculator.Verdict.MAYBE -> "🟡 НА ГРАНИ" to Amber
                Calculator.Verdict.SKIP -> "🔴 НЕВЫГОДНО" to Red
            }
            Text("$label · чистыми ≈ ${e.net.rub()} · ${e.netPerHour.rub()}/час", color = color, fontWeight = FontWeight.Bold)
        } else {
            Text("Сумма подставится при завершении заказа.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun OrderRow(order: OrderEntity, s: CostSettings, onDelete: () -> Unit) {
    SectionCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("${order.timestamp.time()} · ${order.price.rub()}", fontWeight = FontWeight.Bold)
                Text(
                    "${order.distanceKm.km()} · ${order.durationMin} мин · чистыми ≈ ${Calculator.orderNet(order.price, order.distanceKm, s).rub()}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, contentDescription = "Удалить") }
        }
    }
}

@Composable
fun AddOrderDialog(s: CostSettings, onDismiss: () -> Unit, onConfirm: (Double, Double, Int) -> Unit) {
    var price by remember { mutableStateOf("") }
    var km by remember { mutableStateOf("") }
    var min by remember { mutableStateOf("") }
    val p = price.parseNumber()
    val k = km.parseNumber()
    val m = min.parseNumber()?.toInt()
    val valid = p != null && p > 0 && k != null && k >= 0 && m != null && m > 0

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новый заказ") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField(price, { price = it }, "Стоимость", suffix = "₽")
                NumberField(km, { km = it }, "Расстояние", suffix = "км")
                NumberField(min, { min = it }, "Время", suffix = "мин", integer = true)
                if (p != null && k != null) {
                    Text(
                        "Чистыми ≈ ${Calculator.orderNet(p, k, s).rub()}",
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        },
        confirmButton = { TextButton(enabled = valid, onClick = { onConfirm(p!!, k!!, m!!) }) { Text("Добавить") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

@Composable
fun FinishOrderDialog(
    trackedKm: Double,
    minutes: Int,
    suggestedPrice: Double?,
    settings: CostSettings,
    onDismiss: () -> Unit,
    onConfirm: (Double, Double?) -> Unit,
) {
    var price by remember { mutableStateOf(suggestedPrice?.edit() ?: "") }
    var km by remember { mutableStateOf(trackedKm.edit()) }
    val p = price.parseNumber()
    val k = km.parseNumber()
    val valid = p != null && p > 0 && k != null && k >= 0
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Заказ завершён") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("$minutes мин · по GPS ${trackedKm.km()}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                NumberField(price, { price = it }, "Стоимость", suffix = "₽", supporting = if (suggestedPrice != null) "Подставлено из уведомления Яндекс Про" else null)
                NumberField(km, { km = it }, "Расстояние", suffix = "км", supporting = "Можно поправить, если GPS ошибся")
                if (p != null && k != null) {
                    Text("Чистыми ≈ ${Calculator.orderNet(p, k, settings).rub()}", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                }
            }
        },
        confirmButton = { TextButton(enabled = valid, onClick = { onConfirm(p!!, if (k == trackedKm) null else k) }) { Text("Сохранить") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

@Composable
fun EndShiftDialog(trackedIdle: Double?, onDismiss: () -> Unit, onConfirm: (Double, Double) -> Unit) {
    var idle by remember { mutableStateOf(trackedIdle?.edit() ?: "") }
    var extra by remember { mutableStateOf("") }
    val i = if (idle.isBlank()) 0.0 else idle.parseNumber()
    val e = if (extra.isBlank()) 0.0 else extra.parseNumber()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Завершить смену") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField(
                    idle, { idle = it }, "Холостой пробег", suffix = "км",
                    supporting = if (trackedIdle != null) "Посчитано по GPS, можно поправить" else "Километры без пассажира за смену",
                )
                NumberField(extra, { extra = it }, "Прочие расходы", suffix = "₽", supporting = "Мойка, парковка, еда и т.п.")
            }
        },
        confirmButton = { TextButton(enabled = i != null && e != null, onClick = { onConfirm(i!!, e!!) }) { Text("Завершить") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}
