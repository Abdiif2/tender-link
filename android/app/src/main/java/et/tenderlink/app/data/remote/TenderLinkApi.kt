package et.tenderlink.app.data.remote

import et.tenderlink.app.data.remote.dto.AnalyticsEventRequest
import et.tenderlink.app.data.remote.dto.AuthSessionResponse
import et.tenderlink.app.data.remote.dto.LoginRequest
import et.tenderlink.app.data.remote.dto.ProfileResponse
import et.tenderlink.app.data.remote.dto.RefreshRequest
import et.tenderlink.app.data.remote.dto.RegisterRequest
import et.tenderlink.app.data.remote.dto.RegisterResponse
import et.tenderlink.app.data.remote.dto.TendersPageResponse
import et.tenderlink.app.data.remote.dto.UpdateLanguageRequest
import et.tenderlink.app.data.remote.dto.VerifyOtpRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * Connects directly to the existing TenderLink Ethiopia Express + PostgreSQL API.
 * All validation, RBAC, OTP verification, and business rules stay on the server.
 */
interface TenderLinkApi {

    @POST("api/v1/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<RegisterResponse>

    @POST("api/v1/auth/otp/verify")
    suspend fun verifyOtp(@Body request: VerifyOtpRequest): Response<AuthSessionResponse>

    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthSessionResponse>

    @POST("api/v1/auth/refresh")
    suspend fun refreshSession(@Body request: RefreshRequest): Response<AuthSessionResponse>

    @POST("api/v1/auth/logout")
    suspend fun logout(@Body request: RefreshRequest): Response<Unit>

    @GET("api/v1/profile")
    suspend fun getProfile(): Response<ProfileResponse>

    @PATCH("api/v1/profile")
    suspend fun updatePreferredLanguage(@Body request: UpdateLanguageRequest): Response<ProfileResponse>

    @GET("api/v1/tenders/preview")
    suspend fun getTendersFeed(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 15,
        @Query("sourceType") sourceType: String? = null
    ): Response<TendersPageResponse>

    @POST("api/v1/analytics/events")
    suspend fun trackAnalyticsEvent(@Body request: AnalyticsEventRequest): Response<Unit>
}
