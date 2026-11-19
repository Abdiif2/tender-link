package et.tenderlink.app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import et.tenderlink.app.R
import et.tenderlink.app.ui.components.PrimaryCtaButton
import et.tenderlink.app.ui.components.StateFeedbackCard
import et.tenderlink.app.ui.theme.BrandForestGreen
import et.tenderlink.app.ui.theme.CanvasAlabaster
import et.tenderlink.app.ui.theme.InkPrimary
import et.tenderlink.app.ui.theme.InkSecondary

@Composable
fun AuthScreen(
    viewModel: AuthViewModel,
    sessionExpiredBanner: Boolean,
    onAuthenticated: () -> Unit,
    onNavigateToOtp: (String) -> Unit,
    onContinueAsGuest: () -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CanvasAlabaster)
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = stringResource(R.string.app_name),
            style = MaterialTheme.typography.headlineMedium,
            color = InkPrimary
        )

        if (sessionExpiredBanner) {
            StateFeedbackCard(
                title = stringResource(R.string.tab_sign_in),
                body = stringResource(R.string.session_expired_msg),
                isError = true
            )
        }

        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            SegmentedButton(
                selected = !state.isRegisterMode,
                onClick = { viewModel.setMode(false) },
                shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2)
            ) {
                Text(stringResource(R.string.tab_sign_in))
            }
            SegmentedButton(
                selected = state.isRegisterMode,
                onClick = { viewModel.setMode(true) },
                shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2)
            ) {
                Text(stringResource(R.string.tab_register))
            }
        }

        if (state.isRegisterMode) {
            OutlinedTextField(
                value = state.fullName,
                onValueChange = viewModel::updateFullName,
                label = { Text(stringResource(R.string.field_full_name)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }

        OutlinedTextField(
            value = state.identifier,
            onValueChange = viewModel::updateIdentifier,
            label = { Text(stringResource(R.string.field_identifier)) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = state.password,
            onValueChange = viewModel::updatePassword,
            label = { Text(stringResource(R.string.field_password)) },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth()
        )

        if (state.isRegisterMode) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = state.marketingConsent,
                    onCheckedChange = viewModel::updateMarketingConsent,
                    colors = CheckboxDefaults.colors(checkedColor = BrandForestGreen)
                )
                Text(
                    text = stringResource(R.string.marketing_consent),
                    style = MaterialTheme.typography.bodyMedium,
                    color = InkSecondary
                )
            }
        }

        state.errorMessage?.let { errorMsg ->
            Text(
                text = errorMsg,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error
            )
        }

        Spacer(Modifier.height(4.dp))

        PrimaryCtaButton(
            text = stringResource(
                if (state.isRegisterMode) R.string.tab_register else R.string.tab_sign_in
            ),
            loading = state.isLoading,
            onClick = {
                viewModel.submitAuth(
                    onLoginSuccess = onAuthenticated,
                    onOtpRequired = onNavigateToOtp
                )
            }
        )

        TextButton(
            onClick = onContinueAsGuest,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        ) {
            Text(
                text = stringResource(R.string.continue_as_guest),
                color = BrandForestGreen
            )
        }
    }
}
