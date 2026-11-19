package et.tenderlink.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.mutableStateOf
import et.tenderlink.app.core.analytics.AnalyticsEvent
import et.tenderlink.app.notifications.TenderLinkMessagingService
import et.tenderlink.app.ui.navigation.TenderLinkNavGraph
import et.tenderlink.app.ui.theme.TenderLinkTheme

/**
 * Extends AppCompatActivity so per-app Amharic/English locales work seamlessly on Android 8.0+.
 */
class MainActivity : AppCompatActivity() {

    private val deepLinkTenderId = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val container = (application as TenderLinkApp).container
        container.analyticsTracker.track(AnalyticsEvent.APP_OPEN)
        handleIncomingIntent(intent, container)

        setContent {
            TenderLinkTheme {
                TenderLinkNavGraph(
                    container = container,
                    initialDeepLinkTenderId = deepLinkTenderId.value
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val container = (application as TenderLinkApp).container
        handleIncomingIntent(intent, container)
    }

    private fun handleIncomingIntent(intent: Intent?, container: et.tenderlink.app.di.AppContainer) {
        if (intent == null) return
        val fromPush = intent.getBooleanExtra(TenderLinkMessagingService.EXTRA_FROM_PUSH_ALERT, false)
        val tenderId = intent.getStringExtra(TenderLinkMessagingService.EXTRA_TENDER_ID)
            ?: intent.data?.lastPathSegment

        if (fromPush) {
            container.analyticsTracker.track(
                AnalyticsEvent.ALERT_CLICK,
                mapOf("tenderId" to (tenderId ?: "home"))
            )
        }
        if (!tenderId.isNullOrBlank()) {
            deepLinkTenderId.value = tenderId
        }
    }
}
