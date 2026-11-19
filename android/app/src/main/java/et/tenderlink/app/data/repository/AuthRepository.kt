package et.tenderlink.app.data.repository

import et.tenderlink.app.core.security.SecureTokenStorage
import et.tenderlink.app.data.remote.TenderLinkApi
import et.tenderlink.app.data.remote.dto.ApiErrorEnvelope
import et.tenderlink.app.data.remote.dto.LoginRequest
import et.tenderlink.app.data.remote.dto.RefreshRequest
import et.tenderlink.app.data.remote.dto.RegisterRequest
import et.tenderlink.app.data.remote.dto.RegisterResponse
import et.tenderlink.app.data.remote.dto.UpdateLanguageRequest
import et.tenderlink.app.data.remote.dto.UserDto
import et.tenderlink.app.data.remote.dto.VerifyOtpRequest
import kotlinx.serialization.json.Json
import retrofit2.Response

sealed interface RepoResult<out T> {
    data class Success<T>(val data: T) : RepoResult<T>
    data class Error(val message: String, val code: String = "REQUEST_ERROR") : RepoResult<Nothing>
}

class AuthRepository(
    private val api: TenderLinkApi,
    private val tokenStorage: SecureTokenStorage,
    private val json: Json
) {
    fun isLoggedIn(): Boolean = tokenStorage.isLoggedIn()

    fun currentDisplayName(): String? = tokenStorage.getDisplayName()

    suspend fun register(
        fullName: String,
        identifier: String,
        password: String,
        preferredLanguage: String,
        marketingConsent: Boolean
    ): RepoResult<RegisterResponse> {
        return runCatching {
            val trimmed = identifier.trim()
            val isEmail = trimmed.contains("@")
            val response = api.register(
                RegisterRequest(
                    fullName = fullName.trim(),
                    email = if (isEmail) trimmed else null,
                    phone = if (!isEmail) trimmed else null,
                    password = password,
                    preferredLanguage = preferredLanguage,
                    marketingConsent = marketingConsent
                )
            )
            mapResponse(response)
        }.getOrElse {
            RepoResult.Error("Network unavailable. Check your connection and try again.", "NETWORK")
        }
    }

    suspend fun verifyOtp(destination: String, code: String): RepoResult<UserDto?> {
        return runCatching {
            val response = api.verifyOtp(VerifyOtpRequest(destination = destination, code = code))
            when (val mapped = mapResponse(response)) {
                is RepoResult.Success -> {
                    tokenStorage.saveTokens(
                        accessToken = mapped.data.accessToken,
                        refreshToken = mapped.data.refreshToken,
                        userId = mapped.data.user?.id,
                        displayName = mapped.data.user?.fullName
                    )
                    RepoResult.Success(mapped.data.user)
                }
                is RepoResult.Error -> mapped
            }
        }.getOrElse {
            RepoResult.Error("Network unavailable. Check your connection and try again.", "NETWORK")
        }
    }

    suspend fun login(identifier: String, password: String): RepoResult<UserDto?> {
        return runCatching {
            val response = api.login(LoginRequest(identifier = identifier.trim(), password = password))
            when (val mapped = mapResponse(response)) {
                is RepoResult.Success -> {
                    tokenStorage.saveTokens(
                        accessToken = mapped.data.accessToken,
                        refreshToken = mapped.data.refreshToken,
                        userId = mapped.data.user?.id,
                        displayName = mapped.data.user?.fullName
                    )
                    RepoResult.Success(mapped.data.user)
                }
                is RepoResult.Error -> mapped
            }
        }.getOrElse {
            RepoResult.Error("Network unavailable. Check your connection and try again.", "NETWORK")
        }
    }

    suspend fun syncLanguageIfSignedIn(language: String) {
        if (!tokenStorage.isLoggedIn()) return
        runCatching {
            api.updatePreferredLanguage(UpdateLanguageRequest(preferredLanguage = language))
        }
    }

    suspend fun logout() {
        val refresh = tokenStorage.getRefreshToken()
        tokenStorage.clear()
        if (!refresh.isNullOrBlank()) {
            runCatching { api.logout(RefreshRequest(refresh)) }
        }
    }

    private fun <T> mapResponse(response: Response<T>): RepoResult<T> {
        val body = response.body()
        if (response.isSuccessful && body != null) {
            return RepoResult.Success(body)
        }
        val rawError = response.errorBody()?.string()
        val parsed = rawError?.let {
            runCatching { json.decodeFromString<ApiErrorEnvelope>(it) }.getOrNull()
        }
        return RepoResult.Error(
            message = parsed?.error?.message ?: "Server returned HTTP ${response.code()}",
            code = parsed?.error?.code ?: "HTTP_${response.code()}"
        )
    }
}
