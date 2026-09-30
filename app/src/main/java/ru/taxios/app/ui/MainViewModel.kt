package ru.taxios.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import ru.taxios.app.TaxiApp
import ru.taxios.app.data.NotificationLogEntity
import ru.taxios.app.data.OrderEntity
import ru.taxios.app.data.Repository
import ru.taxios.app.data.ShiftEntity
import ru.taxios.app.data.ShiftWithOrders
import ru.taxios.app.data.pausedMinutesAt
import ru.taxios.app.data.toInput
import ru.taxios.app.domain.Calculator
import ru.taxios.app.domain.CostSettings
import ru.taxios.app.domain.ShiftSummary
import ru.taxios.app.tracking.TrackingService
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class TodayState(
    val settings: CostSettings = CostSettings(),
    val summary: ShiftSummary = ShiftSummary(),
    val activeShift: ShiftEntity? = null,
    val activeOrders: List<OrderEntity> = emptyList(),
    val activeMinutes: Int = 0,
    val activeOrderMinutes: Int = 0,
    val pausedMinutes: Int = 0,
    /** Последнее уведомление Яндекс Про с распознанной ценой (не старше 15 минут). */
    val suggestion: NotificationLogEntity? = null,
)

@OptIn(ExperimentalCoroutinesApi::class)
class MainViewModel(app: Application, private val repo: Repository) : AndroidViewModel(app) {

    private val ticker = flow {
        while (true) {
            emit(System.currentTimeMillis())
            delay(15_000)
        }
    }

    val settings: StateFlow<CostSettings> =
        repo.settings.stateIn(viewModelScope, SharingStarted.Eagerly, CostSettings())

    val shifts: StateFlow<List<ShiftWithOrders>> =
        repo.shifts.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val activeShift: StateFlow<ShiftEntity?> =
        repo.activeShift.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private val activeOrders: StateFlow<List<OrderEntity>> = activeShift
        .flatMapLatest { s -> if (s == null) flowOf(emptyList()) else repo.ordersFor(s.id) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val notifications: StateFlow<List<NotificationLogEntity>> =
        repo.notifications.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val today: StateFlow<TodayState> =
        combine(settings, shifts, activeShift, activeOrders, notifications, ticker) { values ->
            @Suppress("UNCHECKED_CAST")
            val s = values[0] as CostSettings
            @Suppress("UNCHECKED_CAST")
            val all = values[1] as List<ShiftWithOrders>
            val active = values[2] as ShiftEntity?
            @Suppress("UNCHECKED_CAST")
            val orders = values[3] as List<OrderEntity>
            @Suppress("UNCHECKED_CAST")
            val notes = values[4] as List<NotificationLogEntity>
            val now = values[5] as Long
            val zone = ZoneId.systemDefault()
            val todayDate = LocalDate.now(zone)
            val todays = all.filter { Instant.ofEpochMilli(it.shift.startTime).atZone(zone).toLocalDate() == todayDate }
            TodayState(
                settings = s,
                summary = Calculator.summarize(todays.map { it.toInput(now) }, s),
                activeShift = active,
                activeOrders = orders,
                activeMinutes = active?.let { (((now - it.startTime) / 60_000L).toInt() - it.pausedMinutesAt(now)).coerceAtLeast(0) } ?: 0,
                activeOrderMinutes = active?.activeOrderStart?.let { ((now - it) / 60_000L).toInt() } ?: 0,
                pausedMinutes = active?.pausedMinutesAt(now) ?: 0,
                suggestion = notes.firstOrNull { it.price != null && now - it.timestamp < 15 * 60_000L },
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TodayState())

    fun startShift() = viewModelScope.launch {
        val id = repo.startShift()
        TrackingService.start(getApplication(), id)
    }

    fun endShift(manualKm: Double?, extraExpenses: Double) = viewModelScope.launch {
        activeShift.value?.let { repo.endShift(it, manualKm, extraExpenses) }
        TrackingService.stop(getApplication())
    }

    fun setShiftKm(manualKm: Double?) = viewModelScope.launch { activeShift.value?.let { repo.setShiftKm(it.id, manualKm) } }

    /** Перезапуск трекинга, если смена активна, а сервис был убит системой. */
    fun ensureTracking() {
        activeShift.value?.let { TrackingService.start(getApplication(), it.id) }
    }

    fun addOrder(price: Double, km: Double, minutes: Int) = viewModelScope.launch {
        val shiftId = activeShift.value?.id ?: repo.startShift()
        repo.addOrder(shiftId, price, km, minutes)
    }

    fun pauseShift() = viewModelScope.launch { activeShift.value?.let { repo.pauseShift(it.id) } }

    fun resumeShift() = viewModelScope.launch { activeShift.value?.let { repo.resumeShift(it.id) } }

    fun startOrder() = viewModelScope.launch { activeShift.value?.let { repo.startOrder(it.id) } }

    fun finishOrder(price: Double, kmOverride: Double?) = viewModelScope.launch {
        activeShift.value?.let { repo.finishOrder(it.id, price, kmOverride) }
    }

    fun cancelOrder() = viewModelScope.launch { activeShift.value?.let { repo.cancelOrder(it.id) } }

    fun setOrderPrice(order: OrderEntity, price: Double, km: Double) = viewModelScope.launch { repo.setOrderPrice(order, price, km) }

    fun deleteOrder(order: OrderEntity) = viewModelScope.launch { repo.deleteOrder(order) }

    fun deleteShift(shift: ShiftEntity) = viewModelScope.launch { repo.deleteShift(shift) }

    fun saveSettings(s: CostSettings) = viewModelScope.launch { repo.saveSettings(s) }

    fun clearNotifications() = viewModelScope.launch { repo.clearNotifications() }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as TaxiApp
                MainViewModel(app, app.repository)
            }
        }
    }
}
