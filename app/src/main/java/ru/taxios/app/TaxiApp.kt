package ru.taxios.app

import android.app.Application
import ru.taxios.app.data.AppDatabase
import ru.taxios.app.data.Repository
import ru.taxios.app.data.SettingsStore

class TaxiApp : Application() {
    val repository: Repository by lazy { Repository(AppDatabase.create(this), SettingsStore(this)) }
}
