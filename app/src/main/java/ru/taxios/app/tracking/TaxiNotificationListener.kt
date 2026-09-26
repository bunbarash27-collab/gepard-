package ru.taxios.app.tracking

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import ru.taxios.app.TaxiApp
import ru.taxios.app.data.NotificationLogEntity

/** Читает уведомления Яндекс Про и складывает их в журнал вместе с распознанными цифрами. */
class TaxiNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var lastKey: String? = null

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in WATCHED_PACKAGES) return
        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = listOfNotNull(
            extras.getCharSequence(Notification.EXTRA_TEXT),
            extras.getCharSequence(Notification.EXTRA_BIG_TEXT),
            extras.getCharSequence(Notification.EXTRA_SUB_TEXT),
            extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString("\n"),
        ).map { it.toString() }.distinct().joinToString("\n").trim()
        if (title.isBlank() && text.isBlank()) return

        // Одинаковые обновления одного уведомления не дублируем.
        val key = "${sbn.key}|$title|$text"
        if (key == lastKey) return
        lastKey = key

        val parsed = OrderTextParser.parse("$title\n$text")
        scope.launch {
            (application as TaxiApp).repository.logNotification(
                NotificationLogEntity(
                    timestamp = sbn.postTime,
                    packageName = sbn.packageName,
                    title = title,
                    text = text,
                    price = parsed.price,
                    distanceKm = parsed.distanceKm,
                    durationMin = parsed.durationMin,
                ),
            )
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        val WATCHED_PACKAGES = setOf("ru.yandex.taximeter")

        fun isEnabled(context: Context): Boolean {
            val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
            val me = ComponentName(context, TaxiNotificationListener::class.java)
            return flat.split(':').any { ComponentName.unflattenFromString(it) == me }
        }

        fun openSettings(context: Context) {
            context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}
