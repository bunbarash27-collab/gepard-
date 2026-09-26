package ru.taxios.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.taxios.app.ui.MainViewModel
import ru.taxios.app.ui.SectionCard
import ru.taxios.app.ui.date
import ru.taxios.app.ui.km
import ru.taxios.app.ui.rub
import ru.taxios.app.ui.time

@Composable
fun NotificationsScreen(vm: MainViewModel, onBack: () -> Unit) {
    val items by vm.notifications.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад") }
            Text("Журнал уведомлений", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = {
                    val body = items.joinToString("\n\n") { n ->
                        "${n.timestamp.date()} ${n.timestamp.time()} [${n.packageName}]\n${n.title}\n${n.text}"
                    }
                    val send = android.content.Intent(android.content.Intent.ACTION_SEND)
                        .setType("text/plain")
                        .putExtra(android.content.Intent.EXTRA_SUBJECT, "TAXI OS — журнал уведомлений")
                        .putExtra(android.content.Intent.EXTRA_TEXT, body)
                    context.startActivity(android.content.Intent.createChooser(send, "Отправить журнал"))
                },
                enabled = items.isNotEmpty(),
                modifier = Modifier.weight(1f),
            ) { Text("Поделиться") }
            OutlinedButton(onClick = { vm.clearNotifications() }, enabled = items.isNotEmpty(), modifier = Modifier.weight(1f)) { Text("Очистить") }
        }
        Text(
            "Сюда попадают уведомления Яндекс Про. Распознанные цифры выделены. Отправьте журнал разработчику после пары смен, чтобы улучшить распознавание.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(16.dp),
        )
        LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (items.isEmpty()) {
                item { Text("Пока пусто. Включите доступ к уведомлениям в настройках и дождитесь заказа.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            items(items, key = { it.id }) { n ->
                SectionCard {
                    Text("${n.timestamp.date()} · ${n.timestamp.time()}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (n.title.isNotBlank()) Text(n.title, fontWeight = FontWeight.Bold)
                    if (n.text.isNotBlank()) Text(n.text, style = MaterialTheme.typography.bodyMedium)
                    val parsed = listOfNotNull(n.price?.rub(), n.distanceKm?.km(), n.durationMin?.let { "$it мин" })
                    if (parsed.isNotEmpty()) {
                        Text("Распознано: ${parsed.joinToString(" · ")}", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}
