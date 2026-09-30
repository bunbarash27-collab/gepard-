package ru.taxios.app.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import ru.taxios.app.MainActivity
import ru.taxios.app.TaxiApp
import ru.taxios.app.data.NotificationLogEntity
import ru.taxios.app.data.OrderEntity

/**
 * Читает уведомления Яндекс Про, пишет их в журнал и по статусам
 * («На заказе», «На линии», «Занят») автоматически ведёт смену.
 */
class TaxiNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutex = Mutex()
    private var lastKey: String? = null
    private var lastStatus: StatusAutomation.Status? = null

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
        val status = StatusAutomation.statusOf(text)
        scope.launch {
            val repo = (application as TaxiApp).repository
            repo.logNotification(
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
            if (status != null) mutex.withLock { applyStatus(status) }
        }
    }

    private suspend fun applyStatus(status: StatusAutomation.Status) {
        val repo = (application as TaxiApp).repository
        if (!repo.currentSettings().autoMode) { lastStatus = status; return }
        var shift = repo.getActiveShift()
        val state = StatusAutomation.State(
            shiftActive = shift != null,
            inOrder = shift?.activeOrderStart != null,
            paused = shift?.pausedSince != null,
            lastStatus = lastStatus,
        )
        for (action in StatusAutomation.decide(state, status)) {
            when (action) {
                StatusAutomation.Action.START_SHIFT -> {
                    val id = repo.startShift()
                    TrackingService.start(this, id)
                    shift = repo.getActiveShift()
                }
                StatusAutomation.Action.START_ORDER -> shift?.let { repo.startOrder(it.id) }
                StatusAutomation.Action.FINISH_ORDER -> shift?.let { finishAutomatically(it.id) }
                StatusAutomation.Action.PAUSE -> shift?.let { repo.pauseShift(it.id) }
                StatusAutomation.Action.RESUME -> shift?.let { repo.resumeShift(it.id) }
            }
        }
        lastStatus = status
    }

    private suspend fun finishAutomatically(shiftId: Long) {
        val repo = (application as TaxiApp).repository
        val shift = repo.getActiveShift() ?: return
        val start = shift.activeOrderStart ?: return
        // Меньше минуты и без движения — отмена, а не поездка.
        if (System.currentTimeMillis() - start < 60_000L && shift.activeOrderKm < 0.1) {
            repo.cancelOrder(shiftId)
            return
        }
        val order = repo.finishOrder(shiftId, price = null) ?: return
        askForPrice(order)
    }

    private fun askForPrice(order: OrderEntity) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Заказы", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val n = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .setContentTitle("Заказ завершён — укажите сумму")
            .setContentText("%.1f км · %d мин".format(order.distanceKm, order.durationMin))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        nm.notify(PRICE_NOTIFICATION_ID, n)
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        val WATCHED_PACKAGES = setOf("ru.yandex.taximeter")
        private const val CHANNEL_ID = "orders"
        private const val PRICE_NOTIFICATION_ID = 2

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
