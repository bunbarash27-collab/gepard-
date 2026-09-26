package ru.taxios.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val TaxiYellow = Color(0xFFFFC107)
val Green = Color(0xFF4CAF50)
val Amber = Color(0xFFFFB300)
val Red = Color(0xFFEF5350)

private val DarkScheme = darkColorScheme(
    primary = TaxiYellow,
    onPrimary = Color(0xFF1A1A1A),
    primaryContainer = Color(0xFF5C4400),
    onPrimaryContainer = Color(0xFFFFE08A),
    secondary = Color(0xFFB0BEC5),
    background = Color(0xFF121212),
    surface = Color(0xFF1E1E1E),
    surfaceVariant = Color(0xFF2A2A2A),
    onSurfaceVariant = Color(0xFFBDBDBD),
    error = Red,
)

// Тёмная тема всегда: водители часто работают ночью.
@Composable
fun TaxiOsTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkScheme, content = content)
}
