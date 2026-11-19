package et.tenderlink.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import et.tenderlink.app.R
import et.tenderlink.app.core.util.DeadlineFormatter
import et.tenderlink.app.data.remote.dto.TenderPreviewDto
import et.tenderlink.app.ui.theme.BorderHairline
import et.tenderlink.app.ui.theme.BrandForestGreen
import et.tenderlink.app.ui.theme.FeaturedGold
import et.tenderlink.app.ui.theme.InkMuted
import et.tenderlink.app.ui.theme.InkPrimary
import et.tenderlink.app.ui.theme.InkSecondary
import et.tenderlink.app.ui.theme.StatusDangerBg
import et.tenderlink.app.ui.theme.StatusDangerRed
import et.tenderlink.app.ui.theme.StatusOpenGreen
import et.tenderlink.app.ui.theme.StatusWarningAmber
import et.tenderlink.app.ui.theme.StatusWarningBg
import et.tenderlink.app.ui.theme.SubtleSlateBg
import et.tenderlink.app.ui.theme.SurfaceWhite

@Composable
fun IndependenceNoticeBanner(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(SubtleSlateBg)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Outlined.Info,
            contentDescription = null,
            tint = InkMuted,
            modifier = Modifier.size(16.dp)
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = stringResource(R.string.independent_notice),
            style = MaterialTheme.typography.labelMedium,
            color = InkSecondary
        )
    }
}

@Composable
fun OfflineBannerBar(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(StatusWarningBg)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Outlined.CloudOff,
            contentDescription = null,
            tint = StatusWarningAmber,
            modifier = Modifier.size(18.dp)
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = stringResource(R.string.offline_banner),
            style = MaterialTheme.typography.labelMedium,
            color = StatusWarningAmber,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
fun PrimaryCtaButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = BrandForestGreen,
            contentColor = Color.White
        ),
        modifier = modifier
            .fillMaxWidth()
            .height(48.dp) // >= 48dp Material 3 touch target
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = Color.White,
                strokeWidth = 2.dp,
                modifier = Modifier.size(20.dp)
            )
            Spacer(Modifier.width(10.dp))
        }
        Text(
            text = text,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun TenderFeedCard(
    tender: TenderPreviewDto,
    lang: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val title = if (lang == "am" && !tender.titleAm.isNullOrBlank()) tender.titleAm else tender.titleEn
    val summary = if (lang == "am" && !tender.summaryAm.isNullOrBlank()) tender.summaryAm else tender.summaryEn
    val category = if (lang == "am") tender.categoryNameAm else tender.categoryNameEn
    val region = if (lang == "am") tender.regionNameAm else tender.regionNameEn
    val countdown = DeadlineFormatter.formatCountdown(tender.closingAt, lang)

    val sourceLabel = when (tender.sourceType) {
        "official_source" -> stringResource(R.string.source_official)
        "publisher_submitted" -> stringResource(R.string.source_publisher)
        "partner_feed" -> stringResource(R.string.source_partner)
        else -> stringResource(R.string.source_reported)
    }

    val statusColor = when {
        countdown.isClosed || tender.status == "expired" -> StatusDangerRed
        countdown.isUrgent || tender.status == "amended" -> StatusWarningAmber
        else -> StatusOpenGreen
    }

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        color = SurfaceWhite
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
            // Line 1: Clean unboxed provenance metadata (Zero-Pill Discipline)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = buildString {
                        append(sourceLabel)
                        append(" · ")
                        append(region)
                        if (tender.isSampleData) {
                            append(" · ")
                            append(if (lang == "am") "የናሙና" else "Sample")
                        }
                    },
                    style = MaterialTheme.typography.labelMedium,
                    color = BrandForestGreen,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                if (tender.isFeatured) {
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = stringResource(R.string.featured_label),
                        style = MaterialTheme.typography.labelMedium,
                        color = FeaturedGold,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            Spacer(Modifier.height(4.dp))

            Text(
                text = tender.publisherNameDisplay,
                style = MaterialTheme.typography.labelMedium,
                color = InkSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(Modifier.height(6.dp))

            // Line 2: Title & Summary
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = InkPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(Modifier.height(4.dp))

            Text(
                text = summary,
                style = MaterialTheme.typography.bodyMedium,
                color = InkSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(Modifier.height(10.dp))

            // Line 3: Countdown, EAT Closing Date, Sector & ETB Doc Fee
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Outlined.Schedule,
                        contentDescription = null,
                        tint = statusColor,
                        modifier = Modifier.size(15.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        text = "${countdown.label} · ${DeadlineFormatter.formatEatDate(tender.closingAt)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = statusColor,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Text(
                    text = DeadlineFormatter.formatEtb(tender.documentFeeEtb, lang),
                    style = MaterialTheme.typography.labelSmall,
                    color = InkPrimary,
                    fontFamily = FontFamily.Monospace
                )
            }

            Spacer(Modifier.height(4.dp))

            Text(
                text = "$category${tender.referenceNumber?.let { " · $it" } ?: ""}",
                style = MaterialTheme.typography.labelMedium,
                color = InkMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
    HorizontalDivider(color = BorderHairline, thickness = 1.dp)
}

@Composable
fun TenderSkeletonCard() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceWhite)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.45f)
                .height(12.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(BorderHairline)
        )
        Box(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .height(18.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(BorderHairline)
        )
        Box(
            modifier = Modifier
                .fillMaxWidth(0.75f)
                .height(14.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(SubtleSlateBg)
        )
        Box(
            modifier = Modifier
                .fillMaxWidth(0.6f)
                .height(12.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(SubtleSlateBg)
        )
    }
    HorizontalDivider(color = BorderHairline, thickness = 1.dp)
}

@Composable
fun StateFeedbackCard(
    title: String,
    body: String,
    isError: Boolean = false,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        shape = RoundedCornerShape(12.dp),
        color = if (isError) StatusDangerBg else SurfaceWhite,
        border = BorderStroke(1.dp, if (isError) StatusDangerRed.copy(alpha = 0.25f) else BorderHairline)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = if (isError) StatusDangerRed else InkPrimary
            )
            Text(
                text = body,
                style = MaterialTheme.typography.bodyMedium,
                color = InkSecondary
            )
            if (actionLabel != null && onAction != null) {
                Spacer(Modifier.height(4.dp))
                OutlinedButton(
                    onClick = onAction,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.height(44.dp)
                ) {
                    Text(actionLabel, color = BrandForestGreen, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
