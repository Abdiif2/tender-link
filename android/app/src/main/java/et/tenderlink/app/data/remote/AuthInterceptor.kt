package et.tenderlink.app.data.remote

import et.tenderlink.app.core.security.SecureTokenStorage
import et.tenderlink.app.data.remote.dto.RefreshRequest
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/**
 * Attaches Bearer access token and active Accept-Language header to every backend request.
 */
class AuthHeaderInterceptor(
    private val tokenStorage: SecureTokenStorage,
    private val languageProvider: () -> String
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val builder = original.newBuilder()
            .header("Accept", "application/json")
            .header("Accept-Language", languageProvider())

        val accessToken = tokenStorage.getAccessToken()
        if (!accessToken.isNullOrBlank()) {
            builder.header("Authorization", "Bearer $accessToken")
        }

        return chain.proceed(builder.build())
    }
}

/**
 * Handles expired sessions (HTTP 401) by rotating the refresh token once against /api/v1/auth/refresh.
 * If refresh fails, clears encrypted tokens and notifies UI to prompt sign-in.
 */
class TokenRefreshAuthenticator(
    private val tokenStorage: SecureTokenStorage,
    private val refreshApiProvider: () -> TenderLinkApi
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.request.url.encodedPath.contains("/api/v1/auth/")) {
            return null
        }
        if (responseCount(response) >= 2) {
            tokenStorage.markSessionExpired()
            return null
        }

        val refreshToken = tokenStorage.getRefreshToken() ?: run {
            tokenStorage.markSessionExpired()
            return null
        }

        synchronized(this) {
            val currentToken = tokenStorage.getAccessToken()
            val failedToken = response.request.header("Authorization")?.removePrefix("Bearer ")
            if (!currentToken.isNullOrBlank() && currentToken != failedToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $currentToken")
                    .build()
            }

            val refreshResult = runBlocking {
                runCatching {
                    refreshApiProvider().refreshSession(RefreshRequest(refreshToken))
                }.getOrNull()
            }

            val body = refreshResult?.body()
            if (refreshResult?.isSuccessful == true && body != null) {
                tokenStorage.saveTokens(
                    accessToken = body.accessToken,
                    refreshToken = body.refreshToken,
                    userId = body.user?.id,
                    displayName = body.user?.fullName ?: tokenStorage.getDisplayName()
                )
                return response.request.newBuilder()
                    .header("Authorization", "Bearer ${body.accessToken}")
                    .build()
            }

            tokenStorage.markSessionExpired()
            return null
        }
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
