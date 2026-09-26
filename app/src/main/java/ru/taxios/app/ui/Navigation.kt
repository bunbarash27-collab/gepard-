package ru.taxios.app.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import ru.taxios.app.ui.screens.CalculatorScreen
import ru.taxios.app.ui.screens.SettingsScreen
import ru.taxios.app.ui.screens.StatsScreen
import ru.taxios.app.ui.screens.TodayScreen

enum class Dest(val route: String, val label: String, val icon: ImageVector) {
    Today("today", "Сегодня", Icons.Default.Home),
    Calculator("calculator", "Заказ", Icons.Default.Calculate),
    Stats("stats", "Статистика", Icons.Default.BarChart),
    Settings("settings", "Настройки", Icons.Default.Settings),
}

@Composable
fun TaxiOsApp() {
    val navController = rememberNavController()
    val vm: MainViewModel = viewModel(factory = MainViewModel.Factory)
    val backStack by navController.currentBackStackEntryAsState()
    val current = backStack?.destination

    Scaffold(
        bottomBar = {
            NavigationBar {
                Dest.values().forEach { d ->
                    NavigationBarItem(
                        selected = current?.hierarchy?.any { it.route == d.route } == true,
                        onClick = {
                            navController.navigate(d.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(d.icon, contentDescription = d.label) },
                        label = { Text(d.label) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(navController, startDestination = Dest.Today.route, modifier = Modifier.padding(padding)) {
            composable(Dest.Today.route) { TodayScreen(vm) }
            composable(Dest.Calculator.route) { CalculatorScreen(vm) }
            composable(Dest.Stats.route) { StatsScreen(vm) }
            composable(Dest.Settings.route) { SettingsScreen(vm) }
        }
    }
}
