package et.tenderlink.app.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class ApiErrorEnvelope(
    val error: ApiErrorBody? = null
)

@Serializable
data class ApiErrorBody(
    val code: String = "UNKNOWN",
    val message: String = "An unexpected error occurred."
)

// ============================================================================
// AUTH DTOs
// ============================================================================

@Serializable
data class RegisterRequest(
    val fullName: String,
    val email: String? = null,
    val phone: String? = null,
    val password: String,
    val preferredLanguage: String = "en",
    val marketingConsent: Boolean = false
)

@Serializable
data class RegisterResponse(
    val userId: String,
    val destination: String,
    val purpose: String,
    val otpRequired: Boolean,
    val expiresInSeconds: Int
)

@Serializable
data class VerifyOtpRequest(
    val destination: String,
    val code: String
)

@Serializable
data class LoginRequest(
    val identifier: String,
    val password: String
)

@Serializable
data class RefreshRequest(
    val refreshToken: String
)

@Serializable
data class UserDto(
    val id: String,
    val fullName: String,
    val email: String? = null,
    val phone: String? = null,
    val preferredLanguage: String = "en",
    val marketingConsent: Boolean = false,
    val roles: List<String> = emptyList()
)

@Serializable
data class AuthSessionResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresInSeconds: Int,
    val roles: List<String> = emptyList(),
    val user: UserDto? = null
)

@Serializable
data class ProfileResponse(
    val user: UserDto
)

@Serializable
data class UpdateLanguageRequest(
    val preferredLanguage: String
)

// ============================================================================
// TENDERS & TAXONOMY DTOs
// ============================================================================

@Serializable
data class TenderPreviewDto(
    val id: String,
    val referenceNumber: String? = null,
    val titleEn: String,
    val titleAm: String? = null,
    val summaryEn: String,
    val summaryAm: String? = null,
    val sourceType: String,
    val sourceName: String,
    val publisherNameDisplay: String,
    val procurementMethod: String,
    val documentFeeEtb: Int? = null,
    val bidSecurityEtb: Int? = null,
    val hasDocuments: Boolean = false,
    val publishedAt: String? = null,
    val closingAt: String,
    val status: String,
    val isFeatured: Boolean = false,
    val isSampleData: Boolean = false,
    val categoryNameEn: String,
    val categoryNameAm: String,
    val regionNameEn: String,
    val regionNameAm: String
)

@Serializable
data class PaginationDto(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int
)

@Serializable
data class TendersPageResponse(
    val items: List<TenderPreviewDto>,
    val pagination: PaginationDto
)

@Serializable
data class AnalyticsEventRequest(
    val eventName: String,
    val platform: String = "android",
    val language: String = "en",
    val metadata: Map<String, String> = emptyMap()
)
