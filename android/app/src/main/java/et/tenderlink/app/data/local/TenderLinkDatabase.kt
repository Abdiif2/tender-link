package et.tenderlink.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import et.tenderlink.app.data.local.dao.TenderDao
import et.tenderlink.app.data.local.entity.CachedTenderEntity

@Database(
    entities = [CachedTenderEntity::class],
    version = 1,
    exportSchema = false
)
abstract class TenderLinkDatabase : RoomDatabase() {
    abstract fun tenderDao(): TenderDao

    companion object {
        fun build(context: Context): TenderLinkDatabase =
            Room.databaseBuilder(
                context.applicationContext,
                TenderLinkDatabase::class.java,
                "tenderlink_cache.db"
            ).build()
    }
}
