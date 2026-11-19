# Android release and signing

## Build variants

- Debug installs as `et.tenderlink.app.debug` and uses the development API URL.
- Release installs as `et.tenderlink.app` and uses the pre-release API URL.
- Both API URLs and the App Link host can be overridden with Gradle properties or matching environment variables.
- Version defaults to code `1` and name `1.0.0`; override with `TENDERLINK_VERSION_CODE` and `TENDERLINK_VERSION_NAME`.

## Create and protect the upload key

Run locally (do not upload or commit the keystore):

```bash
keytool -genkey -v -keystore android/app/upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias tenderlink-upload
cp android/keystore.properties.example android/keystore.properties
```

Edit `android/keystore.properties` with the actual credentials. Keep encrypted backups of the keystore and credentials in separate secure locations. Never commit either file.

For CI, supply these secrets instead of the local properties file:

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The keystore path in CI must point to a file made available to the job from a protected secret or secure artifact. Do not put secret values in Gradle properties or repository files.

## Build and verify

From the repository root:

```bash
cd android
./gradlew testDebugUnitTest
./gradlew assembleDebug
./gradlew bundleRelease
```

The release bundle is written under `android/app/build/outputs/bundle/release/`. Confirm release signing is configured before uploading it to Play Console.

Use overrides as needed:

```bash
./gradlew bundleRelease \
  -PTENDERLINK_API_BASE_URL_RELEASE=https://your-production-api.example/ \
  -PTENDERLINK_APP_LINK_HOST=your-domain.example \
  -PTENDERLINK_VERSION_CODE=2 \
  -PTENDERLINK_VERSION_NAME=1.0.1
```

To use a custom domain later, set `TENDERLINK_APP_LINK_HOST=tenderlink.et`. Verified App Links also require the backend to serve a valid `/.well-known/assetlinks.json` containing the Play App Signing certificate fingerprint. Debug builds use a distinct application ID and are not listed in Play Store asset links.
