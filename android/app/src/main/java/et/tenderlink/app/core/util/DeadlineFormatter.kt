package et.tenderlink.app.core.util

import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

object DeadlineFormatter {

    private val eatZone: ZoneId = ZoneId.of("Africa/Addis_Ababa")
    private val dateFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH).withZone(eatZone)

    data class CountdownResult(
        val label: String,
        val isUrgent: Boolean,
        val isClosed: Boolean
    )

    fun formatCountdown(
        closingIso: String,
        lang: String,
        now: Instant = Instant.now()
    ): CountdownResult {
        val closing = runCatching { Instant.parse(closingIso) }.getOrNull()
            ?: return CountdownResult(label = "—", isUrgent = false, isClosed = false)

        val diff = Duration.between(now, closing)
        if (diff.isNegative || diff.isZero) {
            return CountdownResult(
                label = if (lang == "am") "የተዘጋ" else "Closed",
                isUrgent = false,
                isClosed = true
            )
        }

        val totalHours = diff.toHours()
        val days = totalHours / 24
        val remainingHours = totalHours % 24

        return when {
            days >= 1 -> CountdownResult(
                label = if (lang == "am") "${days} ቀን ቀረው" else "${days}d ${remainingHours}h left",
                isUrgent = days <= 3,
                isClosed = false
            )
            totalHours >= 1 -> CountdownResult(
                label = if (lang == "am") "${totalHours} ሰዓት ቀረው" else "${totalHours}h left",
                isUrgent = true,
                isClosed = false
            )
            else -> {
                val mins = diff.toMinutes().coerceAtLeast(1)
                CountdownResult(
                    label = if (lang == "am") "${mins} ደቂቃ ቀረው" else "${mins}m left",
                    isUrgent = true,
                    isClosed = false
                )
            }
        }
    }

    fun formatEatDate(iso: String?): String {
        if (iso.isNullOrBlank()) return "—"
        return runCatching { dateFormatter.format(Instant.parse(iso)) }.getOrDefault("—")
    }

    fun formatEtb(amount: Int?, lang: String): String {
        if (amount == null || amount <= 0) {
            return if (lang == "am") "ነፃ" else "Free"
        }
        val num = NumberFormat.getIntegerInstance(Locale.US).format(amount)
        return if (lang == "am") "$num ብር" else "ETB $num"
    }
}
