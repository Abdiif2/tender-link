package et.tenderlink.app.core.prefs

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore by preferencesDataStore(name = "tenderlink_settings")

class LanguagePreferences(private val context: Context) {

    val languageFlow: Flow<String> = context.settingsDataStore.data.map { prefs ->
        prefs[KEY_LANGUAGE] ?: "en"
    }

    val onboardingCompletedFlow: Flow<Boolean> = context.settingsDataStore.data.map { prefs ->
        prefs[KEY_ONBOARDING_DONE] ?: false
    }

    val languageSelectedFlow: Flow<Boolean> = context.settingsDataStore.data.map { prefs ->
        prefs[KEY_LANGUAGE_SELECTED] ?: false
    }

    suspend fun getCurrentLanguage(): String = languageFlow.first()

    suspend fun setLanguage(code: String) {
        val normalized = if (code == "am") "am" else "en"
        context.settingsDataStore.edit { prefs ->
            prefs[KEY_LANGUAGE] = normalized
            prefs[KEY_LANGUAGE_SELECTED] = true
        }
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(normalized))
    }

    suspend fun markOnboardingCompleted() {
        context.settingsDataStore.edit { prefs ->
            prefs[KEY_ONBOARDING_DONE] = true
        }
    }

    private companion object {
        val KEY_LANGUAGE = stringPreferencesKey("preferred_language")
        val KEY_LANGUAGE_SELECTED = booleanPreferencesKey("language_selected")
        val KEY_ONBOARDING_DONE = booleanPreferencesKey("onboarding_completed")
    }
}
