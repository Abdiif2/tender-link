package et.tenderlink.app.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import et.tenderlink.app.R
import et.tenderlink.app.ui.components.IndependenceNoticeBanner
import et.tenderlink.app.ui.components.OfflineBannerBar
import et.tenderlink.app.ui.components.StateFeedbackCard
import et.tenderlink.app.ui.components.TenderFeedCard
import et.tenderlink.app.ui.components.TenderSkeletonCard
import et.tenderlink.app.ui.theme.BrandForestGreen
import et.tenderlink.app.ui.theme.BrandSoftTint
import et.tenderlink.app.ui.theme.CanvasAlabaster
import et.tenderlink.app.ui.theme.InkPrimary
import et.tenderlink.app.ui.theme.SurfaceWhite

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeFeedScreen(
    viewModel: HomeFeedViewModel,
    lang: String,
    isOnline: Boolean,
    onOpenLanguage: () -> Unit,
    onOpenTender: (String) -> Unit,
    bottomBar: @Composable () -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    val sourceOptions = listOf(
        null to stringResource(R.string.source_all),
        "official_source" to stringResource(R.string.source_official),
        "publisher_submitted" to stringResource(R.string.source_publisher),
        "partner_feed" to stringResource(R.string.source_partner),
        "user_reported" to stringResource(R.string.source_reported)
    )

    Scaffold(
        containerColor = CanvasAlabaster,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.app_name),
                        style = MaterialTheme.typography.titleLarge,
                        color = InkPrimary,
                        fontWeight = FontWeight.Bold
                    )
                },
                actions = {
                    IconButton(onClick = onOpenLanguage) {
                        Icon(
                            imageVector = Icons.Outlined.Language,
                            contentDescription = stringResource(R.string.choose_language_title),
                            tint = InkPrimary
                        )
                    }
                    IconButton(onClick = { viewModel.loadInitial() }) {
                        Icon(
                            imageVector = Icons.Outlined.Refresh,
                            contentDescription = stringResource(R.string.retry),
                            tint = InkPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        bottomBar = bottomBar
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (!isOnline || state.isFromCache) {
                OfflineBannerBar()
            }

            IndependenceNoticeBanner()

            // Horizontal 4-source interactive filter chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceWhite)
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                sourceOptions.forEach { (value, label) ->
                    val selected = state.selectedSourceType == value
                    FilterChip(
                        selected = selected,
                        onClick = { viewModel.selectSource(value) },
                        label = { Text(label, maxLines = 1) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = BrandSoftTint,
                            selectedLabelColor = BrandForestGreen
                        )
                    )
                }
            }

            when {
                state.isLoading -> {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(6) { TenderSkeletonCard() }
                    }
                }

                state.errorMessage != null && state.items.isEmpty() -> {
                    StateFeedbackCard(
                        title = stringResource(R.string.error_network),
                        body = state.errorMessage ?: "",
                        isError = true,
                        actionLabel = stringResource(R.string.retry),
                        onAction = { viewModel.loadInitial() }
                    )
                }

                state.items.isEmpty() -> {
                    StateFeedbackCard(
                        title = stringResource(R.string.empty_feed_title),
                        body = stringResource(R.string.empty_feed_body),
                        actionLabel = stringResource(R.string.source_all),
                        onAction = { viewModel.selectSource(null) }
                    )
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                        items(state.items, key = { it.id }) { tender ->
                            TenderFeedCard(
                                tender = tender,
                                lang = lang,
                                onClick = {
                                    viewModel.onTenderClicked(tender.id)
                                    onOpenTender(tender.id)
                                }
                            )
                        }

                        if (state.page < state.totalPages) {
                            item(key = "load_more") {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    OutlinedButton(
                                        onClick = { viewModel.loadNextPage() },
                                        enabled = !state.isLoadingMore,
                                        modifier = Modifier.height(48.dp)
                                    ) {
                                        Text(
                                            text = if (state.isLoadingMore) "…" else stringResource(R.string.load_more),
                                            color = BrandForestGreen,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
