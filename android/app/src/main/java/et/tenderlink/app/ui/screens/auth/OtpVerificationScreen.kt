package et.tenderlink.app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import et.tenderlink.app.R
import et.tenderlink.app.ui.components.PrimaryCtaButton
import et.tenderlink.app.ui.theme.CanvasAlabaster
import et.tenderlink.app.ui.theme.InkPrimary
import et.tenderlink.app.ui.theme.InkSecondary

@Composable
fun OtpVerificationScreen(
    destination: String,
    viewModel: AuthViewModel,
    onVerified: () -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CanvasAlabaster)
            .safeDrawingPadding()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Spacer(Modifier.height(12.dp))
        Text(
            text = stringResource(R.string.otp_title),
            style = MaterialTheme.typography.headlineMedium,
            color = InkPrimary
        )
        Text(
            text = stringResource(R.string.otp_subtitle, destination),
            style = MaterialTheme.typography.bodyMedium,
            color = InkSecondary
        )

        OutlinedTextField(
            value = state.otpCode,
            onValueChange = viewModel::updateOtpCode,
            label = { Text(stringResource(R.string.otp_code_label)) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth()
        )

        state.errorMessage?.let { errorMsg ->
            Text(
                text = errorMsg,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error
            )
        }

        Spacer(Modifier.height(8.dp))

        PrimaryCtaButton(
            text = stringResource(R.string.otp_verify_cta),
            loading = state.isLoading,
            enabled = state.otpCode.length == 6,
            onClick = { viewModel.verifyOtp(destination = destination, onSuccess = onVerified) }
        )
    }
}
