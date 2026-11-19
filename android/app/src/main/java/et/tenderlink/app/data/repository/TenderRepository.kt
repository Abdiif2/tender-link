package et.tenderlink.app.data.repository

import et.tenderlink.app.data.local.dao.TenderDao
import et.tenderlink.app.data.local.entity.toCachedEntity
import et.tenderlink.app.data.local.entity.toDto
import et.tenderlink.app.data.remote.TenderLinkApi
import et.tenderlink.app.data.remote.dto.TenderPreviewDto

data class TenderFeedPage(
    val items: List<TenderPreviewDto>,
    val page: Int,
    val totalPages: Int,
    val total: Int,
    val isFromCache: Boolean
)

/**
 * Network-first paginated repository with automatic Room SQLite fallback for offline/slow networks.
 */
class TenderRepository(
    private val api: TenderLinkApi,
    private val tenderDao: TenderDao
) {
    suspend fun fetchFeedPage(
        page: Int,
        limit: Int = 15,
        sourceType: String? = null
    ): RepoResult<TenderFeedPage> {
        val networkResult = runCatching {
            val response = api.getTendersFeed(
                page = page,
                limit = limit,
                sourceType = sourceType
            )
            if (response.isSuccessful && response.body() != null) {
                val payload = response.body()!!
                val now = System.currentTimeMillis()
                tenderDao.upsertAll(payload.items.map { it.toCachedEntity(cachedAt = now) })
                // Prune unviewed cache entries older than 7 days to keep low-end storage lean
                tenderDao.pruneStaleUnviewed(now - SEVEN_DAYS_MS)

                RepoResult.Success(
                    TenderFeedPage(
                        items = payload.items,
                        page = payload.pagination.page,
                        totalPages = payload.pagination.totalPages,
                        total = payload.pagination.total,
                        isFromCache = false
                    )
                )
            } else {
                null
            }
        }.getOrNull()

        if (networkResult != null) {
            return networkResult
        }

        // Graceful offline fallback from local Room cache
        val offset = (page - 1) * limit
        val cached = tenderDao.getCachedFeed(sourceType = sourceType, limit = limit, offset = offset)
        val cachedTotal = tenderDao.countCached(sourceType = sourceType)

        return if (cached.isNotEmpty() || page > 1) {
            RepoResult.Success(
                TenderFeedPage(
                    items = cached.map { it.toDto() },
                    page = page,
                    totalPages = maxOf(1, (cachedTotal + limit - 1) / limit),
                    total = cachedTotal,
                    isFromCache = true
                )
            )
        } else {
            RepoResult.Error(
                message = "Unable to load tenders. Check your internet connection and retry.",
                code = "OFFLINE_EMPTY"
            )
        }
    }

    suspend fun markTenderViewed(tenderId: String) {
        runCatching { tenderDao.markViewed(tenderId, System.currentTimeMillis()) }
    }

    private companion object {
        const val SEVEN_DAYS_MS = 7L * 24 * 60 * 60 * 1000
    }
}
