package et.tenderlink.app.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.WorkOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import et.tenderlink.app.R
import et.tenderlink.app.di.AppContainer
import et.tenderlink.app.ui.components.StateFeedbackCard
import et.tenderlink.app.ui.screens.auth.AuthScreen
import et.tenderlink.app.ui.screens.auth.AuthViewModel
import et.tenderlink.app.ui.screens.auth.OtpVerificationScreen
import et.tenderlink.app.ui.screens.home.HomeFeedScreen
import et.tenderlink.app.ui.screens.home.HomeFeedViewModel
import et.tenderlink.app.ui.screens.language.LanguageSelectionScreen
import et.tenderlink.app.ui.screens.splash.SplashOnboardingScreen
import et.tenderlink.app.ui.theme.SurfaceWhite
import kotlinx.coroutines.launch

/**
 * Full 15-screen Android route map. Milestone 1 implements routes 1–5; routes 6–15 are cleanly
 * scaffolded so deep links and bottom navigation never crash during Milestone 1 testing.
 */
object Routes {
    const val SPLASH = "splash"
    const val LANGUAGE = "language"
    const val AUTH = "auth"
    const val OTP = "otp/{destination}"
    const val HOME = "home"
    const val SEARCH = "search"
    const val TENDER_DETAIL = "tender/{tenderId}"
    const val SAVED = "saved"
    const val ALERTS = "alerts"
    const val PLANS = "plans"
    const val PUBLISHER = "publisher"
    const val NOTIFICATIONS = "notifications"
    const val ACCOUNT = "account"

    fun otp(destination: String) = "otp/$destination"
    fun tenderDetail(tenderId: String) = "tender/$tenderId"
}

@Composable
fun TenderLinkNavGraph(
    container: AppContainer,
    initialDeepLinkTenderId: String? = null
) {
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()

    val currentLang by container.languagePreferences.languageFlow.collectAsStateWithLifecycle("en")
    val onboardingDone by container.languagePreferences.onboardingCompletedFlow.collectAsStateWithLifecycle(false)
    val isOnline by container.connectivityObserver.isOnlineFlow.collectAsStateWithLifecycle(true)
    val sessionExpired by container.tokenStorage.sessionExpired.collectAsStateWithLifecycle()

    val authViewModel = remember {
        AuthViewModel(container.authRepository) { container.currentLanguageSync() }
    }
    val homeFeedViewModel = remember {
        HomeFeedViewModel(container.tenderRepository, container.analyticsTracker)
    }

    // Handle expired session cleanly by routing to Auth with banner
    LaunchedEffect(sessionExpired) {
        if (sessionExpired) {
            navController.navigate(Routes.AUTH) {
                launchSingleTop = true
            }
        }
    }

    // Handle push notification deep links to tender detail
    LaunchedEffect(initialDeepLinkTenderId) {
        if (!initialDeepLinkTenderId.isNullOrBlank() && initialDeepLinkTenderId != "home") {
            navController.navigate(Routes.tenderDetail(initialDeepLinkTenderId))
        }
    }

    val startDestination = if (onboardingDone) Routes.HOME else Routes.SPLASH

    val bottomBar: @Composable () -> Unit = {
        val backStack by navController.currentBackStackEntryAsState()
        val currentRoute = backStack?.destination?.route
        NavigationBar(containerColor = SurfaceWhite) {
            NavigationBarItem(
                selected = currentRoute == Routes.HOME,
                onClick = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.HOME) { inclusive = false }
                        launchSingleTop = true
                    }
                },
                icon = { Icon(Icons.Outlined.WorkOutline, contentDescription = null) },
                label = { Text(stringResource(R.string.nav_tenders), maxLines = 1) }
            )
            NavigationBarItem(
                selected = currentRoute == Routes.SAVED,
                onClick = {
                    navController.navigate(Routes.SAVED) { launchSingleTop = true }
                },
                icon = { Icon(Icons.Outlined.BookmarkBorder, contentDescription = null) },
                label = { Text(stringResource(R.string.nav_saved), maxLines = 1) }
            )
            NavigationBarItem(
                selected = currentRoute == Routes.PLANS,
                onClick = {
                    navController.navigate(Routes.PLANS) { launchSingleTop = true }
                },
                icon = { Icon(Icons.Outlined.CreditCard, contentDescription = null) },
                label = { Text(stringResource(R.string.nav_plans), maxLines = 1) }
            )
            NavigationBarItem(
                selected = currentRoute == Routes.ACCOUNT,
                onClick = {
                    if (container.authRepository.isLoggedIn()) {
                        navController.navigate(Routes.ACCOUNT) { launchSingleTop = true }
                    } else {
                        navController.navigate(Routes.AUTH) { launchSingleTop = true }
                    }
                },
                icon = { Icon(Icons.Outlined.PersonOutline, contentDescription = null) },
                label = { Text(stringResource(R.string.nav_account), maxLines = 1) }
            )
        }
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Routes.SPLASH) {
            SplashOnboardingScreen(
                onContinue = {
                    navController.navigate(Routes.LANGUAGE)
                }
            )
        }

        composable(Routes.LANGUAGE) {
            LanguageSelectionScreen(
                currentLanguage = currentLang,
                onSelectAndContinue = { chosen ->
                    scope.launch {
                        container.updateCachedLanguage(chosen)
                        container.languagePreferences.setLanguage(chosen)
                        container.languagePreferences.markOnboardingCompleted()
                        container.authRepository.syncLanguageIfSignedIn(chosen)
                        if (container.authRepository.isLoggedIn()) {
                            navController.navigate(Routes.HOME) {
                                popUpTo(0) { inclusive = true }
                            }
                        } else {
                            navController.navigate(Routes.AUTH) {
                                popUpTo(Routes.SPLASH) { inclusive = true }
                            }
                        }
                    }
                }
            )
        }

        composable(Routes.AUTH) {
            AuthScreen(
                viewModel = authViewModel,
                sessionExpiredBanner = sessionExpired,
                onAuthenticated = {
                    container.tokenStorage.consumeSessionExpiredFlag()
                    navController.navigate(Routes.HOME) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onNavigateToOtp = { destination ->
                    navController.navigate(Routes.otp(destination))
                },
                onContinueAsGuest = {
                    container.tokenStorage.consumeSessionExpiredFlag()
                    navController.navigate(Routes.HOME) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(
            route = Routes.OTP,
            arguments = listOf(navArgument("destination") { type = NavType.StringType })
        ) { entry ->
            val destination = entry.arguments?.getString("destination").orEmpty()
            OtpVerificationScreen(
                destination = destination,
                viewModel = authViewModel,
                onVerified = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.HOME) {
            HomeFeedScreen(
                viewModel = homeFeedViewModel,
                lang = currentLang,
                isOnline = isOnline,
                onOpenLanguage = { navController.navigate(Routes.LANGUAGE) },
                onOpenTender = { tenderId ->
                    navController.navigate(Routes.tenderDetail(tenderId))
                },
                bottomBar = bottomBar
            )
        }

        // Deep-link-enabled Tender Detail route (full view delivered in Android Milestone 2)
        composable(
            route = Routes.TENDER_DETAIL,
            arguments = listOf(navArgument("tenderId") { type = NavType.StringType }),
            deepLinks = listOf(
                navDeepLink { uriPattern = "tenderlink://tender/{tenderId}" },
                navDeepLink { uriPattern = "https://tenderlink.et/tenders/{tenderId}" }
            )
        ) { entry ->
            val tenderId = entry.arguments?.getString("tenderId").orEmpty()
            MilestonePlaceholderScreen(
                title = "Tender #$tenderId",
                subtitle = stringResource(R.string.coming_next_milestone),
                onBack = { navController.popBackStack() },
                bottomBar = bottomBar
            )
        }

        composable(Routes.SAVED) {
            MilestonePlaceholderScreen(
                title = stringResource(R.string.nav_saved),
                subtitle = stringResource(R.string.coming_next_milestone),
                onBack = { navController.navigate(Routes.HOME) },
                bottomBar = bottomBar
            )
        }

        composable(Routes.PLANS) {
            MilestonePlaceholderScreen(
                title = stringResource(R.string.nav_plans),
                subtitle = stringResource(R.string.coming_next_milestone),
                onBack = { navController.navigate(Routes.HOME) },
                bottomBar = bottomBar
            )
        }

        composable(Routes.ACCOUNT) {
            MilestonePlaceholderScreen(
                title = container.authRepository.currentDisplayName()
                    ?: stringResource(R.string.nav_account),
                subtitle = stringResource(R.string.coming_next_milestone),
                actionLabel = "Sign Out",
                onBack = {
                    scope.launch {
                        container.authRepository.logout()
                        navController.navigate(Routes.AUTH) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                },
                bottomBar = bottomBar
            )
        }
    }
}

@Composable
private fun MilestonePlaceholderScreen(
    title: String,
    subtitle: String,
    actionLabel: String = "Back to Tenders",
    onBack: () -> Unit,
    bottomBar: @Composable () -> Unit
) {
    Scaffold(bottomBar = bottomBar) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center
        ) {
            StateFeedbackCard(
                title = title,
                body = subtitle,
                actionLabel = actionLabel,
                onAction = onBack
            )
        }
    }
}
