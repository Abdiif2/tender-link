import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
    // Apply google-services plugin automatically when app/google-services.json is placed for FCM
}

if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val keystoreProperties = Properties().apply {
    val propertiesFile = rootProject.file("keystore.properties")
    if (propertiesFile.exists()) propertiesFile.inputStream().use(::load)
}

fun signingValue(propertyName: String, environmentName: String): String? =
    System.getenv(environmentName)?.takeIf(String::isNotBlank)
        ?: keystoreProperties.getProperty(propertyName)?.takeIf(String::isNotBlank)

val releaseKeystorePath = signingValue("storeFile", "ANDROID_KEYSTORE_PATH")
val releaseKeystorePassword = signingValue("storePassword", "ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = signingValue("keyAlias", "ANDROID_KEY_ALIAS")
val releaseKeyPassword = signingValue("keyPassword", "ANDROID_KEY_PASSWORD")
val hasReleaseSigning = listOf(
    releaseKeystorePath,
    releaseKeystorePassword,
    releaseKeyAlias,
    releaseKeyPassword
).all { it != null }

fun String.asBuildConfigString(): String = "\"${replace("\\", "\\\\").replace("\"", "\\\"")}\""

fun releaseApiBaseUrl(): String =
    project.findProperty("TENDERLINK_API_BASE_URL")?.toString()
        ?: project.findProperty("TENDERLINK_API_BASE_URL_RELEASE")?.toString()
        ?: System.getenv("TENDERLINK_API_BASE_URL")
        ?: System.getenv("TENDERLINK_API_BASE_URL_RELEASE")
        ?: "https://ais-pre-htodhr45yu6y7b2qutgygv-671794884453.europe-west2.run.app/"

android {
    namespace = "et.tenderlink.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "et.tenderlink.app"
        minSdk = 26 // Android 8.0+
        targetSdk = 35
        versionCode = (project.findProperty("TENDERLINK_VERSION_CODE")?.toString()
            ?: System.getenv("TENDERLINK_VERSION_CODE") ?: "1").toInt()
        versionName = project.findProperty("TENDERLINK_VERSION_NAME")?.toString()
            ?: System.getenv("TENDERLINK_VERSION_NAME") ?: "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
        manifestPlaceholders["appLinkHost"] = project.findProperty("TENDERLINK_APP_LINK_HOST")?.toString()
            ?: System.getenv("TENDERLINK_APP_LINK_HOST")
            ?: "ais-pre-htodhr45yu6y7b2qutgygv-671794884453.europe-west2.run.app"
    }

    signingConfigs {
        create("release") {
            if (hasReleaseSigning) {
                storeFile = file(releaseKeystorePath!!)
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            isCrunchPngs = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField("String", "API_BASE_URL", releaseApiBaseUrl().asBuildConfigString())
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            isMinifyEnabled = false
            val apiBaseUrl = project.findProperty("TENDERLINK_API_BASE_URL_DEBUG")?.toString()
                ?: System.getenv("TENDERLINK_API_BASE_URL_DEBUG")
                ?: "https://ais-dev-htodhr45yu6y7b2qutgygv-671794884453.europe-west2.run.app/"
            buildConfigField("String", "API_BASE_URL", apiBaseUrl.asBuildConfigString())
        }
    }

    bundle {
        language.enableSplit = false
        density.enableSplit = true
        abi.enableSplit = true
    }

    ndk {
        debugSymbolLevel = "FULL"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    androidResources {
        // Retain only English and Amharic resources to minimize APK download size on 3G networks
        localeFilters += listOf("en", "am")
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    // Core & AppCompat (for per-app Amharic/English locale switching on Android 8.0+)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    // Jetpack Compose Material 3 & Navigation
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.4")

    // Networking: Retrofit + OkHttp + Kotlinx Serialization (low-overhead JSON)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Offline Cache: Room SQLite
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // Secure Token Storage (Android Keystore) & Language Preferences (DataStore)
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Push Notifications: Firebase Cloud Messaging
    implementation(platform("com.google.firebase:firebase-bom:33.6.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
