package et.tenderlink.app.ui.screens.language

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import et.tenderlink.app.R
import et.tenderlink.app.ui.components.PrimaryCtaButton
import et.tenderlink.app.ui.theme.BorderHairline
import et.tenderlink.app.ui.theme.BrandForestGreen
import et.tenderlink.app.ui.theme.BrandSoftTint
import et.tenderlink.app.ui.theme.CanvasAlabaster
import et.tenderlink.app.ui.theme.InkPrimary
import et.tenderlink.app.ui.theme.InkSecondary
import et.tenderlink.app.ui.theme.SurfaceWhite

@Composable
fun LanguageSelectionScreen(
    currentLanguage: String,
    onSelectAndContinue: (String) -> Unit
) {
    var selected by remember(currentLanguage) { mutableStateOf(currentLanguage) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CanvasAlabaster)
            .safeDrawingPadding()
            .padding(24.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Spacer(Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.choose_language_title),
                style = MaterialTheme.typography.headlineMedium,
                color = InkPrimary
            )
            Text(
                text = stringResource(R.string.choose_language_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = InkSecondary
            )

            Spacer(Modifier.height(16.dp))

            LanguageOptionRow(
                title = "English",
                subtitle = "Default international business interface",
                selected = selected == "en",
                onClick = { selected = "en" }
            )

            Spacer(Modifier.height(12.dp))

            LanguageOptionRow(
                title = "አማርኛ (Amharic)",
                subtitle = "የኢትዮጵያ የአማርኛ በይነገጽ",
                selected = selected == "am",
                onClick = { selected = "am" }
            )
        }

        PrimaryCtaButton(
            text = stringResource(R.string.continue_cta),
            onClick = { onSelectAndContinue(selected) }
        )
    }
}

@Composable
private fun LanguageOptionRow(
    title: String,
    subtitle: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = if (selected) BrandSoftTint else SurfaceWhite,
        border = BorderStroke(1.dp, if (selected) BrandForestGreen else BorderHairline)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = InkPrimary,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.labelMedium,
                    color = InkSecondary
                )
            }
            RadioButton(
                selected = selected,
                onClick = onClick,
                colors = RadioButtonDefaults.colors(selectedColor = BrandForestGreen)
            )
        }
    }
}
