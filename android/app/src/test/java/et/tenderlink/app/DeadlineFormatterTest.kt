package et.tenderlink.app

import et.tenderlink.app.core.util.DeadlineFormatter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.temporal.ChronoUnit

class DeadlineFormatterTest {

    @Test
    fun `closed tender returns localized closed label`() {
        val now = Instant.parse("2026-11-19T12:00:00Z")
        val past = now.minus(2, ChronoUnit.DAYS).toString()

        val en = DeadlineFormatter.formatCountdown(past, "en", now)
        val am = DeadlineFormatter.formatCountdown(past, "am", now)

        assertTrue(en.isClosed)
        assertEquals("Closed", en.label)
        assertEquals("የተዘጋ", am.label)
    }

    @Test
    fun `urgent tender within 48 hours flags urgency`() {
        val now = Instant.parse("2026-11-19T12:00:00Z")
        val soon = now.plus(36, ChronoUnit.HOURS).toString()

        val res = DeadlineFormatter.formatCountdown(soon, "en", now)

        assertFalse(res.isClosed)
        assertTrue(res.isUrgent)
        assertEquals("1d 12h left", res.label)
    }

    @Test
    fun `formats ETB amounts cleanly in English and Amharic`() {
        assertEquals("ETB 1,499", DeadlineFormatter.formatEtb(1499, "en"))
        assertEquals("1,499 ብር", DeadlineFormatter.formatEtb(1499, "am"))
        assertEquals("Free", DeadlineFormatter.formatEtb(0, "en"))
        assertEquals("ነፃ", DeadlineFormatter.formatEtb(0, "am"))
    }
}
