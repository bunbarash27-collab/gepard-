package ru.taxios.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [ShiftEntity::class, OrderEntity::class, TrackPointEntity::class, NotificationLogEntity::class],
    version = 3,
    exportSchema = true,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun shiftDao(): ShiftDao
    abstract fun orderDao(): OrderDao
    abstract fun trackDao(): TrackDao
    abstract fun notificationLogDao(): NotificationLogDao

    companion object {
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE shifts ADD COLUMN trackedKm REAL NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE shifts ADD COLUMN activeOrderStart INTEGER")
                db.execSQL("ALTER TABLE shifts ADD COLUMN activeOrderKm REAL NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE orders ADD COLUMN auto INTEGER NOT NULL DEFAULT 0")
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS track_points (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, shiftId INTEGER NOT NULL, " +
                        "timestamp INTEGER NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, inOrder INTEGER NOT NULL)",
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS index_track_points_shiftId ON track_points (shiftId)")
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS notification_log (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, timestamp INTEGER NOT NULL, " +
                        "packageName TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, price REAL, distanceKm REAL, durationMin INTEGER)",
                )
            }
        }

        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE shifts ADD COLUMN pausedSince INTEGER")
                db.execSQL("ALTER TABLE shifts ADD COLUMN pausedMinutes INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE orders ADD COLUMN priceMissing INTEGER NOT NULL DEFAULT 0")
            }
        }

        fun create(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "taxios.db")
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                .build()
    }
}
