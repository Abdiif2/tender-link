# Keep runtime-visible annotations and generic signatures used by Retrofit and Kotlin serialization.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# Retrofit service declarations are discovered reflectively from annotations.
-keep interface et.tenderlink.app.data.remote.** { *; }
-keepclassmembers,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

# Preserve serializable DTOs and generated serializers used by Kotlinx Serialization.
-keep class et.tenderlink.app.data.remote.dto.** { *; }
-keepclassmembers class **$$serializer { *; }
-keepclassmembers class kotlinx.serialization.** { *; }

# Room entities and generated database implementation metadata.
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class * { *; }
-keepclassmembers class * {
    @androidx.room.* <fields>;
}

# OkHttp uses service-provider metadata and platform-specific implementations.
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-dontwarn kotlinx.serialization.**

# Remove low-value Android logging calls from release builds.
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
    public static int i(...);
}
