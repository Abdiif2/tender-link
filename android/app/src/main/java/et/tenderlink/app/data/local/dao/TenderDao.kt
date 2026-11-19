package et.tenderlink.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import et.tenderlink.app.data.local.entity.CachedTenderEntity

@Dao
interface TenderDao {

    @Query(
        """
        SELECT * FROM cached_tenders
        WHERE (:sourceType IS NULL OR sourceType = :sourceType)
        ORDER BY isFeatured DESC, closingAt ASC
        LIMIT :limit OFFSET :offset
        """
    )
    suspend fun getCachedFeed(
        sourceType: String?,
        limit: Int,
        offset: Int
    ): List<CachedTenderEntity>

    @Query("SELECT COUNT(*) FROM cached_tenders WHERE (:sourceType IS NULL OR sourceType = :sourceType)")
    suspend fun countCached(sourceType: String?): Int

    @Query("SELECT * FROM cached_tenders WHERE isRecentlyViewed = 1 ORDER BY viewedAt DESC LIMIT 30")
    suspend fun getRecentlyViewed(): List<CachedTenderEntity>

    @Query("UPDATE cached_tenders SET isRecentlyViewed = 1, viewedAt = :viewedAt WHERE id = :tenderId")
    suspend fun markViewed(tenderId: String, viewedAt: Long)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<CachedTenderEntity>)

    @Query("DELETE FROM cached_tenders WHERE isRecentlyViewed = 0 AND cachedAt < :olderThanMillis")
    suspend fun pruneStaleUnviewed(olderThanMillis: Long)
}
