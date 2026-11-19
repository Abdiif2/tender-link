package et.tenderlink.app.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import et.tenderlink.app.MainActivity
import et.tenderlink.app.R

/**
 * Firebase Cloud Messaging service handling deadline alerts, tender amendments, and saved-search matches.
 * Builds deep links (tenderlink://tender/{tenderId}) directly into MainActivity.
 */
class TenderLinkMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Milestone 4 wires POST /api/v1/alerts/preferences to register this FCM token when signed in.
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val tenderId = message.data["tenderId"]
        val title = message.notification?.title
            ?: message.data["title"]
            ?: getString(R.string.app_name)
        val body = message.notification?.body
            ?: message.data["body"]
            ?: return

        showNotification(title = title, body = body, tenderId = tenderId)
    }

    private fun showNotification(title: String, body: String, tenderId: String?) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        ensureChannel(manager)

        val deepLinkUri = if (!tenderId.isNullOrBlank()) {
            Uri.parse("tenderlink://tender/$tenderId")
        } else {
            Uri.parse("tenderlink://tender/home")
        }

        val intent = Intent(Intent.ACTION_VIEW, deepLinkUri, this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_FROM_PUSH_ALERT, true)
            if (!tenderId.isNullOrBlank()) {
                putExtra(EXTRA_TENDER_ID, tenderId)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            tenderId?.hashCode() ?: 1001,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_TENDER_ALERTS)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        manager.notify(tenderId?.hashCode() ?: System.currentTimeMillis().toInt(), notification)
    }

    private fun ensureChannel(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_TENDER_ALERTS,
                "Tender Alerts & Deadlines",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Saved search matches, tender amendments, and deadline reminders."
            }
            manager.createNotificationChannel(channel)
        }
    }

    companion object {
        const val CHANNEL_TENDER_ALERTS = "tenderlink_alerts"
        const val EXTRA_FROM_PUSH_ALERT = "extra_from_push_alert"
        const val EXTRA_TENDER_ID = "extra_tender_id"
    }
}
