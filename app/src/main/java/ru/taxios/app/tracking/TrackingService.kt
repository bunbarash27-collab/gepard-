package ru.taxios.app.tracking

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import ru.taxios.app.MainActivity
import ru.taxios.app.TaxiApp
import ru.taxios.app.data.TrackPointEntity

/**
 * Foreground-сервис: считает пробег смены по GPS и пишет его в активную смену.
 * Пока смена активна, сервис живёт и показывает постоянное уведомление.
 */
class TrackingService : Service(), LocationListener {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var locationManager: LocationManager
    private var last: Location? = null
    private var shiftId: Long = -1
    private var totalKm = 0.0
    private var lastSavedPointAt = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        shiftId = intent?.getLongExtra(EXTRA_SHIFT_ID, -1) ?: -1
        startAsForeground()
        scope.launch {
            val repo = (application as TaxiApp).repository
            // При перезапуске системой заново находим активную смену.
            if (shiftId <= 0) shiftId = repo.getActiveShift()?.id ?: -1
            if (shiftId <= 0) {
                stopSelf(); return@launch
            }
            totalKm = repo.getActiveShift()?.trackedKm ?: 0.0
            updateNotification()
        }
        requestLocation()
        return START_STICKY
    }

    private fun requestLocation() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return
        try {
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, INTERVAL_MS, MIN_DISTANCE_M, this)
        } catch (_: Exception) {
            // GPS-провайдер может отсутствовать (эмулятор, планшет) — используем сеть.
            runCatching { locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, INTERVAL_MS, MIN_DISTANCE_M, this) }
        }
    }

    override fun onLocationChanged(location: Location) {
        if (location.hasAccuracy() && location.accuracy > MAX_ACCURACY_M) return
        val prev = last
        last = location
        if (prev == null) return
        val dtSec = (location.time - prev.time) / 1000.0
        val meters = prev.distanceTo(location).toDouble()
        if (dtSec <= 0) return
        // Отсекаем GPS-дребезг и телепорты.
        if (meters < MIN_DISTANCE_M) return
        if (meters / dtSec > MAX_SPEED_MPS) return
        val km = meters / 1000.0
        totalKm += km
        scope.launch {
            val repo = (application as TaxiApp).repository
            repo.addDistance(shiftId, km)
            if (location.time - lastSavedPointAt >= POINT_INTERVAL_MS) {
                lastSavedPointAt = location.time
                val inOrder = repo.getActiveShift()?.activeOrderStart != null
                repo.addTrackPoint(TrackPointEntity(shiftId = shiftId, timestamp = location.time, lat = location.latitude, lon = location.longitude, inOrder = inOrder))
            }
            updateNotification()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) = Unit
    override fun onProviderEnabled(provider: String) = Unit
    override fun onProviderDisabled(provider: String) = Unit

    override fun onDestroy() {
        locationManager.removeUpdates(this)
        scope.cancel()
        super.onDestroy()
    }

    private fun startAsForeground() {
        val n = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, n)
        }
    }

    private fun updateNotification() {
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("TAXI OS: смена идёт")
            .setContentText("Пробег по GPS: %.1f км".format(totalKm))
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .build()
    }

    private fun createChannel() {
        val channel = NotificationChannel(CHANNEL_ID, "Отслеживание смены", NotificationManager.IMPORTANCE_LOW)
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    companion object {
        private const val CHANNEL_ID = "tracking"
        private const val NOTIFICATION_ID = 1
        private const val EXTRA_SHIFT_ID = "shiftId"
        private const val ACTION_STOP = "ru.taxios.app.STOP_TRACKING"
        private const val INTERVAL_MS = 5_000L
        private const val MIN_DISTANCE_M = 10f
        private const val MAX_ACCURACY_M = 50f
        private const val MAX_SPEED_MPS = 60.0 // ~216 км/ч
        private const val POINT_INTERVAL_MS = 60_000L

        fun start(context: Context, shiftId: Long) {
            val intent = Intent(context, TrackingService::class.java).putExtra(EXTRA_SHIFT_ID, shiftId)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.startService(Intent(context, TrackingService::class.java).setAction(ACTION_STOP))
        }
    }
}
