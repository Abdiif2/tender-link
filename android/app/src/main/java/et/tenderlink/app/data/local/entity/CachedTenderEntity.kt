package et.tenderlink.app.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import et.tenderlink.app.data.remote.dto.TenderPreviewDto

@Entity(
    tableName = "cached_tenders",
    indices = [
        Index(value = ["sourceType", "closingAt"]),
        Index(value = ["isRecentlyViewed", "viewedAt"])
    ]
)
data class CachedTenderEntity(
    @PrimaryKey val id: String,
    val referenceNumber: String?,
    val titleEn: String,
    val titleAm: String?,
    val summaryEn: String,
    val summaryAm: String?,
    val sourceType: String,
    val sourceName: String,
    val publisherNameDisplay: String,
    val procurementMethod: String,
    val documentFeeEtb: Int?,
    val bidSecurityEtb: Int?,
    val hasDocuments: Boolean,
    val publishedAt: String?,
    val closingAt: String,
    val status: String,
    val isFeatured: Boolean,
    val isSampleData: Boolean,
    val categoryNameEn: String,
    val categoryNameAm: String,
    val regionNameEn: String,
    val regionNameAm: String,
    val isRecentlyViewed: Boolean = false,
    val viewedAt: Long = 0L,
    val cachedAt: Long = System.currentTimeMillis()
)

fun TenderPreviewDto.toCachedEntity(cachedAt: Long = System.currentTimeMillis()): CachedTenderEntity =
    CachedTenderEntity(
        id = id,
        referenceNumber = referenceNumber,
        titleEn = titleEn,
        titleAm = titleAm,
        summaryEn = summaryEn,
        summaryAm = summaryAm,
        sourceType = sourceType,
        sourceName = sourceName,
        publisherNameDisplay = publisherNameDisplay,
        procurementMethod = procurementMethod,
        documentFeeEtb = documentFeeEtb,
        bidSecurityEtb = bidSecurityEtb,
        hasDocuments = hasDocuments,
        publishedAt = publishedAt,
        closingAt = closingAt,
        status = status,
        isFeatured = isFeatured,
        isSampleData = isSampleData,
        categoryNameEn = categoryNameEn,
        categoryNameAm = categoryNameAm,
        regionNameEn = regionNameEn,
        regionNameAm = regionNameAm,
        cachedAt = cachedAt
    )

fun CachedTenderEntity.toDto(): TenderPreviewDto = TenderPreviewDto(
    id = id,
    referenceNumber = referenceNumber,
    titleEn = titleEn,
    titleAm = titleAm,
    summaryEn = summaryEn,
    summaryAm = summaryAm,
    sourceType = sourceType,
    sourceName = sourceName,
    publisherNameDisplay = publisherNameDisplay,
    procurementMethod = procurementMethod,
    documentFeeEtb = documentFeeEtb,
    bidSecurityEtb = bidSecurityEtb,
    hasDocuments = hasDocuments,
    publishedAt = publishedAt,
    closingAt = closingAt,
    status = status,
    isFeatured = isFeatured,
    isSampleData = isSampleData,
    categoryNameEn = categoryNameEn,
    categoryNameAm = categoryNameAm,
    regionNameEn = regionNameEn,
    regionNameAm = regionNameAm
)
