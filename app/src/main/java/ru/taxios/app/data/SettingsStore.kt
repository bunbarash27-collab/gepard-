package ru.taxios.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import ru.taxios.app.domain.CostSettings

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

class SettingsStore(private val context: Context) {
    private object Keys {
        val fuelConsumption = doublePreferencesKey("fuel_consumption")
        val fuelPrice = doublePreferencesKey("fuel_price")
        val depreciation = doublePreferencesKey("depreciation_per_km")
        val commission = doublePreferencesKey("commission_percent")
        val emptyReturn = doublePreferencesKey("empty_return_percent")
        val targetHourly = doublePreferencesKey("target_hourly")
        val dailyGoal = doublePreferencesKey("daily_goal")
        val autoMode = booleanPreferencesKey("auto_mode")
    }

    val settings: Flow<CostSettings> = context.dataStore.data.map { p ->
        val d = CostSettings()
        CostSettings(
            fuelConsumptionL100 = p[Keys.fuelConsumption] ?: d.fuelConsumptionL100,
            fuelPricePerL = p[Keys.fuelPrice] ?: d.fuelPricePerL,
            depreciationPerKm = p[Keys.depreciation] ?: d.depreciationPerKm,
            commissionPercent = p[Keys.commission] ?: d.commissionPercent,
            emptyReturnPercent = p[Keys.emptyReturn] ?: d.emptyReturnPercent,
            targetHourlyNet = p[Keys.targetHourly] ?: d.targetHourlyNet,
            dailyGoalNet = p[Keys.dailyGoal] ?: d.dailyGoalNet,
            autoMode = p[Keys.autoMode] ?: d.autoMode,
        )
    }

    suspend fun save(s: CostSettings) {
        context.dataStore.edit { p ->
            p[Keys.fuelConsumption] = s.fuelConsumptionL100
            p[Keys.fuelPrice] = s.fuelPricePerL
            p[Keys.depreciation] = s.depreciationPerKm
            p[Keys.commission] = s.commissionPercent
            p[Keys.emptyReturn] = s.emptyReturnPercent
            p[Keys.targetHourly] = s.targetHourlyNet
            p[Keys.dailyGoal] = s.dailyGoalNet
            p[Keys.autoMode] = s.autoMode
        }
    }
}
