package et.tenderlink.app.di

import android.content.Context
import et.tenderlink.app.BuildConfig
import et.tenderlink.app.core.analytics.AnalyticsTracker
import et.tenderlink.app.core.network.ConnectivityObserver
import et.tenderlink.app.core.prefs.LanguagePreferences
import et.tenderlink.app.core.security.SecureTokenStorage
import et.tenderlink.app.data.local.TenderLinkDatabase
import et.tenderlink.app.data.remote.AuthHeaderInterceptor
import et.tenderlink.app.data.remote.TenderLinkApi
import et.tenderlink.app.data.remote.TokenRefreshAuthenticator
import et.tenderlink.app.data.repository.AuthRepository
import et.tenderlink.app.data.repository.TenderRepository
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Lightweight manual dependency injection container (zero reflection overhead on low-end Android).
 */
class AppContainer(context: Context) {

    val json: Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        explicitNulls = false
    }

    val tokenStorage = SecureTokenStorage(context)
    val languagePreferences = LanguagePreferences(context)
    val connectivityObserver = ConnectivityObserver(context)
    val database = TenderLinkDatabase.build(context)

    @Volatile
    private var cachedLanguage: String = runBlocking { languagePreferences.getCurrentLanguage() }

    fun updateCachedLanguage(lang: String) {
        cachedLanguage = lang
    }

    fun currentLanguageSync(): String = cachedLanguage

    // Separate bare client for token refresh calls so it never loops into the authenticator
    private val refreshClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()
    }

    private val refreshApi: TenderLinkApi by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(refreshClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(TenderLinkApi::class.java)
    }

    private val okHttpClient: OkHttpClient by lazy {
        val builder = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(25, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .addInterceptor(AuthHeaderInterceptor(tokenStorage) { currentLanguageSync() })
            .authenticator(TokenRefreshAuthenticator(tokenStorage) { refreshApi })

        if (BuildConfig.DEBUG) {
            builder.addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BASIC
                }
            )
        }
        builder.build()
    }

    val api: TenderLinkApi by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(TenderLinkApi::class.java)
    }

    val analyticsTracker: AnalyticsTracker by lazy {
        AnalyticsTracker(api) { currentLanguageSync() }
    }

    val authRepository: AuthRepository by lazy {
        AuthRepository(api = api, tokenStorage = tokenStorage, json = json)
    }

    val tenderRepository: TenderRepository by lazy {
        TenderRepository(api = api, tenderDao = database.tenderDao())
    }
}
