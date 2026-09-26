package ru.taxios.app.ui

import androidx.lifecycle.ViewModel
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
import ru.taxios.app.data.OrderEntity
import ru.taxios.app.data.Repository
import ru.taxios.app.data.ShiftEntity
import ru.taxios.app.data.ShiftWithOrders
import ru.taxios.app.data.toInput
import ru.taxios.app.domain.Calculator
import ru.taxios.app.domain.CostSettings
import ru.taxios.app.domain.ShiftSummary
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class TodayState(
    val settings: CostSettings = CostSettings(),
    val summary: ShiftSummary = ShiftSummary(),
    val activeShift: ShiftEntity? = null,
    val activeOrders: List<OrderEntity> = emptyList(),
    val activeMinutes: Int = 0,
)

@OptIn(ExperimentalCoroutinesApi::class)
class MainViewModel(private val repo: Repository) : ViewModel() {

    private val ticker = flow {
        while (true) {
            emit(System.currentTimeMillis())
            delay(30_000)
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

    val today: StateFlow<TodayState> =
        combine(settings, shifts, activeShift, activeOrders, ticker) { s, all, active, orders, now ->
            val zone = ZoneId.systemDefault()
            val todayDate = LocalDate.now(zone)
            val todays = all.filter { Instant.ofEpochMilli(it.shift.startTime).atZone(zone).toLocalDate() == todayDate }
            TodayState(
                settings = s,
                summary = Calculator.summarize(todays.map { it.toInput(now) }, s),
                activeShift = active,
                activeOrders = orders,
                activeMinutes = active?.let { ((now - it.startTime) / 60_000L).toInt() } ?: 0,
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TodayState())

    fun startShift() = viewModelScope.launch { repo.startShift() }

    fun endShift(idleKm: Double, extraExpenses: Double) = viewModelScope.launch {
        activeShift.value?.let { repo.endShift(it, idleKm, extraExpenses) }
    }

    fun addOrder(price: Double, km: Double, minutes: Int) = viewModelScope.launch {
        val shiftId = activeShift.value?.id ?: repo.startShift()
        repo.addOrder(shiftId, price, km, minutes)
    }

    fun deleteOrder(order: OrderEntity) = viewModelScope.launch { repo.deleteOrder(order) }

    fun deleteShift(shift: ShiftEntity) = viewModelScope.launch { repo.deleteShift(shift) }

    fun saveSettings(s: CostSettings) = viewModelScope.launch { repo.saveSettings(s) }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer { MainViewModel((this[APPLICATION_KEY] as TaxiApp).repository) }
        }
    }
}
