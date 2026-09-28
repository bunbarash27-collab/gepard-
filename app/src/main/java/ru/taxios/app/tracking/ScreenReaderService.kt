package ru.taxios.app.tracking

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import ru.taxios.app.TaxiApp
import ru.taxios.app.data.NotificationLogEntity

/**
 * Читает текст с экрана Яндекс Про и вытаскивает стоимость заказа.
 * Строки с ценами пишутся в журнал, чтобы можно было уточнять распознавание.
 */
class ScreenReaderService : AccessibilityService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var lastLogged: String? = null
    private var lastLoggedAt = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.packageName?.toString() !in TaxiNotificationListener.WATCHED_PACKAGES) return
        val root = rootInActiveWindow ?: return
        val lines = ArrayList<String>(64)
        collect(root, lines, 0)
        if (lines.isEmpty()) return
        val priceLines = lines.filterIndexed { i, l -> OrderTextParser.parse(l).price != null || (i + 1 < lines.size && OrderTextParser.parse(lines[i + 1]).price != null) }
        if (priceLines.isEmpty()) return
        val price = OrderTextParser.pickPrice(lines) ?: return
        val joined = priceLines.joinToString("\n")
        val now = System.currentTimeMillis()
        scope.launch {
            val repo = (application as TaxiApp).repository
            repo.recordScreenPrice(price, now)
            if (joined != lastLogged && now - lastLoggedAt > 5_000) {
                lastLogged = joined
                lastLoggedAt = now
                repo.logNotification(
                    NotificationLogEntity(
                        timestamp = now, packageName = "экран Яндекс Про", title = "Строки с суммами",
                        text = joined, price = price,
                    ),
                )
            }
        }
    }

    private fun collect(node: AccessibilityNodeInfo?, out: MutableList<String>, depth: Int) {
        if (node == null || depth > 40 || out.size > MAX_NODES) return
        node.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let { out += it }
        node.contentDescription?.toString()?.trim()?.takeIf { it.isNotEmpty() && it != node.text?.toString() }?.let { out += it }
        for (i in 0 until node.childCount) collect(node.getChild(i), out, depth + 1)
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val MAX_NODES = 400

        fun isEnabled(context: Context): Boolean {
            val flat = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
            val me = ComponentName(context, ScreenReaderService::class.java)
            return flat.split(':').any { ComponentName.unflattenFromString(it) == me }
        }

        fun openSettings(context: Context) {
            context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}
