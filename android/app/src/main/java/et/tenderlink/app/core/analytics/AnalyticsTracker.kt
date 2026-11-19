package et.tenderlink.app.core.analytics

import et.tenderlink.app.data.remote.TenderLinkApi
import et.tenderlink.app.data.remote.dto.AnalyticsEventRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

enum class AnalyticsEvent(val wireName: String) {
    APP_OPEN("app_open"),
    SEARCH("search"),
    TENDER_VIEW("tender_view"),
    ALERT_CLICK("alert_click"),
    SUBSCRIPTION_START("subscription_start"),
    PAYMENT_COMPLETION("payment_completion")
}

class AnalyticsTracker(
    private val api: TenderLinkApi,
    private val languageProvider: () -> String
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun track(event: AnalyticsEvent, metadata: Map<String, String> = emptyMap()) {
        scope.launch {
            runCatching {
                api.trackAnalyticsEvent(
                    AnalyticsEventRequest(
                        eventName = event.wireName,
                        platform = "android",
                        language = languageProvider(),
                        metadata = metadata
                    )
                )
            }
        }
    }
}
