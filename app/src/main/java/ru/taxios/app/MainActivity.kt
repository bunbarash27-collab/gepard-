package ru.taxios.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import ru.taxios.app.ui.TaxiOsApp
import ru.taxios.app.ui.theme.TaxiOsTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TaxiOsTheme {
                TaxiOsApp()
            }
        }
    }
}
