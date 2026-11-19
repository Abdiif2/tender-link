package et.tenderlink.app.ui.screens.splash

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import et.tenderlink.app.R
import et.tenderlink.app.ui.components.IndependenceNoticeBanner
import et.tenderlink.app.ui.components.PrimaryCtaButton
import et.tenderlink.app.ui.theme.BrandForestGreen
import et.tenderlink.app.ui.theme.CanvasAlabaster
import et.tenderlink.app.ui.theme.InkPrimary
import et.tenderlink.app.ui.theme.InkSecondary

@Composable
fun SplashOnboardingScreen(
    onContinue: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CanvasAlabaster)
            .safeDrawingPadding(),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        IndependenceNoticeBanner()

        Column(
            modifier = Modifier.padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = stringResource(R.string.app_name),
                style = MaterialTheme.typography.titleMedium,
                color = BrandForestGreen,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = stringResource(R.string.onboarding_title),
                style = MaterialTheme.typography.headlineMedium,
                color = InkPrimary
            )
            Text(
                text = stringResource(R.string.onboarding_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = InkSecondary
            )
        }

        Column(modifier = Modifier.padding(24.dp)) {
            PrimaryCtaButton(
                text = stringResource(R.string.onboarding_cta),
                onClick = onContinue
            )
            Spacer(Modifier.height(8.dp))
        }
    }
}
