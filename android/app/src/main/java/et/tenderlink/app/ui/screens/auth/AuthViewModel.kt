package et.tenderlink.app.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import et.tenderlink.app.data.repository.AuthRepository
import et.tenderlink.app.data.repository.RepoResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
    val isRegisterMode: Boolean = false,
    val fullName: String = "",
    val identifier: String = "",
    val password: String = "",
    val marketingConsent: Boolean = false,
    val otpCode: String = "",
    val pendingOtpDestination: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

class AuthViewModel(
    private val authRepository: AuthRepository,
    private val languageProvider: () -> String
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    fun setMode(register: Boolean) {
        _uiState.update { it.copy(isRegisterMode = register, errorMessage = null) }
    }

    fun updateFullName(value: String) {
        _uiState.update { it.copy(fullName = value, errorMessage = null) }
    }

    fun updateIdentifier(value: String) {
        _uiState.update { it.copy(identifier = value, errorMessage = null) }
    }

    fun updatePassword(value: String) {
        _uiState.update { it.copy(password = value, errorMessage = null) }
    }

    fun updateMarketingConsent(value: Boolean) {
        _uiState.update { it.copy(marketingConsent = value) }
    }

    fun updateOtpCode(value: String) {
        if (value.length <= 6 && value.all { it.isDigit() }) {
            _uiState.update { it.copy(otpCode = value, errorMessage = null) }
        }
    }

    fun submitAuth(
        onLoginSuccess: () -> Unit,
        onOtpRequired: (destination: String) -> Unit
    ) {
        val current = _uiState.value
        if (current.identifier.trim().length < 5) {
            _uiState.update { it.copy(errorMessage = "Enter a valid email or Ethiopian phone (+251...).") }
            return
        }
        if (current.password.length < 8) {
            _uiState.update { it.copy(errorMessage = "Password must be at least 8 characters.") }
            return
        }
        if (current.isRegisterMode && current.fullName.trim().length < 2) {
            _uiState.update { it.copy(errorMessage = "Enter your full name.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            if (current.isRegisterMode) {
                when (
                    val res = authRepository.register(
                        fullName = current.fullName,
                        identifier = current.identifier,
                        password = current.password,
                        preferredLanguage = languageProvider(),
                        marketingConsent = current.marketingConsent
                    )
                ) {
                    is RepoResult.Success -> {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                pendingOtpDestination = res.data.destination,
                                otpCode = ""
                            )
                        }
                        onOtpRequired(res.data.destination)
                    }
                    is RepoResult.Error -> {
                        _uiState.update { it.copy(isLoading = false, errorMessage = res.message) }
                    }
                }
            } else {
                when (val res = authRepository.login(current.identifier, current.password)) {
                    is RepoResult.Success -> {
                        _uiState.update { it.copy(isLoading = false) }
                        onLoginSuccess()
                    }
                    is RepoResult.Error -> {
                        _uiState.update { it.copy(isLoading = false, errorMessage = res.message) }
                    }
                }
            }
        }
    }

    fun verifyOtp(destination: String, onSuccess: () -> Unit) {
        val code = _uiState.value.otpCode
        if (code.length != 6) {
            _uiState.update { it.copy(errorMessage = "Enter the 6-digit verification code.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val res = authRepository.verifyOtp(destination = destination, code = code)) {
                is RepoResult.Success -> {
                    _uiState.update { it.copy(isLoading = false) }
                    onSuccess()
                }
                is RepoResult.Error -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = res.message) }
                }
            }
        }
    }
}
