package et.tenderlink.app.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import et.tenderlink.app.core.analytics.AnalyticsEvent
import et.tenderlink.app.core.analytics.AnalyticsTracker
import et.tenderlink.app.data.remote.dto.TenderPreviewDto
import et.tenderlink.app.data.repository.RepoResult
import et.tenderlink.app.data.repository.TenderRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeFeedUiState(
    val items: List<TenderPreviewDto> = emptyList(),
    val selectedSourceType: String? = null,
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    val isLoading: Boolean = true,
    val isLoadingMore: Boolean = false,
    val isFromCache: Boolean = false,
    val errorMessage: String? = null
)

class HomeFeedViewModel(
    private val tenderRepository: TenderRepository,
    private val analyticsTracker: AnalyticsTracker
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeFeedUiState())
    val uiState: StateFlow<HomeFeedUiState> = _uiState.asStateFlow()

    init {
        loadInitial()
    }

    fun selectSource(sourceType: String?) {
        if (_uiState.value.selectedSourceType == sourceType && _uiState.value.items.isNotEmpty()) {
            return
        }
        _uiState.update { it.copy(selectedSourceType = sourceType, page = 1) }
        analyticsTracker.track(
            AnalyticsEvent.SEARCH,
            mapOf("sourceType" to (sourceType ?: "all"))
        )
        loadInitial()
    }

    fun loadInitial() {
        val source = _uiState.value.selectedSourceType
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val result = tenderRepository.fetchFeedPage(page = 1, sourceType = source)) {
                is RepoResult.Success -> {
                    _uiState.update {
                        it.copy(
                            items = result.data.items,
                            page = result.data.page,
                            totalPages = result.data.totalPages,
                            total = result.data.total,
                            isLoading = false,
                            isFromCache = result.data.isFromCache,
                            errorMessage = null
                        )
                    }
                }
                is RepoResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }

    fun loadNextPage() {
        val current = _uiState.value
        if (current.isLoading || current.isLoadingMore || current.page >= current.totalPages) {
            return
        }
        val nextPage = current.page + 1
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingMore = true) }
            when (
                val result = tenderRepository.fetchFeedPage(
                    page = nextPage,
                    sourceType = current.selectedSourceType
                )
            ) {
                is RepoResult.Success -> {
                    _uiState.update {
                        it.copy(
                            items = (it.items + result.data.items).distinctBy { item -> item.id },
                            page = result.data.page,
                            totalPages = result.data.totalPages,
                            total = result.data.total,
                            isLoadingMore = false,
                            isFromCache = result.data.isFromCache
                        )
                    }
                }
                is RepoResult.Error -> {
                    _uiState.update {
                        it.copy(isLoadingMore = false, errorMessage = result.message)
                    }
                }
            }
        }
    }

    fun onTenderClicked(tenderId: String) {
        viewModelScope.launch {
            tenderRepository.markTenderViewed(tenderId)
        }
        analyticsTracker.track(AnalyticsEvent.TENDER_VIEW, mapOf("tenderId" to tenderId))
    }
}
