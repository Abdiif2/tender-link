package et.tenderlink.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val BrandForestGreen = Color(0xFF14532D)
val BrandForestHover = Color(0xFF166534)
val BrandSoftTint = Color(0xFFECFDF5)

val CanvasAlabaster = Color(0xFFF8FAFC)
val SurfaceWhite = Color(0xFFFFFFFF)
val SubtleSlateBg = Color(0xFFF1F5F9)
val BorderHairline = Color(0xFFE2E8F0)
val BorderStrong = Color(0xFFCBD5E1)

val InkPrimary = Color(0xFF0F172A)
val InkSecondary = Color(0xFF475569)
val InkMuted = Color(0xFF64748B)

val StatusOpenGreen = Color(0xFF15803D)
val StatusWarningAmber = Color(0xFFB45309)
val StatusWarningBg = Color(0xFFFFFBEB)
val StatusDangerRed = Color(0xFFB91C1C)
val StatusDangerBg = Color(0xFFFEF2F2)
val FeaturedGold = Color(0xFF92400E)

private val TenderLinkColorScheme = lightColorScheme(
    primary = BrandForestGreen,
    onPrimary = Color.White,
    primaryContainer = BrandSoftTint,
    onPrimaryContainer = BrandForestGreen,
    secondary = InkSecondary,
    onSecondary = Color.White,
    background = CanvasAlabaster,
    onBackground = InkPrimary,
    surface = SurfaceWhite,
    onSurface = InkPrimary,
    surfaceVariant = SubtleSlateBg,
    onSurfaceVariant = InkSecondary,
    outline = BorderStrong,
    outlineVariant = BorderHairline,
    error = StatusDangerRed,
    onError = Color.White,
    errorContainer = StatusDangerBg,
    onErrorContainer = StatusDangerRed
)

private val TenderLinkTypography = Typography(
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 24.sp,
        lineHeight = 32.sp,
        color = InkPrimary
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 19.sp,
        lineHeight = 26.sp,
        color = InkPrimary
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 23.sp,
        color = InkPrimary
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 22.sp,
        color = InkSecondary
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 18.sp,
        color = InkMuted
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        color = InkSecondary
    )
)

@Composable
fun TenderLinkTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TenderLinkColorScheme,
        typography = TenderLinkTypography,
        content = content
    )
}
