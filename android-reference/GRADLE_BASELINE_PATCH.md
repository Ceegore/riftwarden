# Android Gradle Baseline Patch

Do not replace the generated Capacitor files wholesale. Apply and verify these values in the exact Phase-02-pinned Capacitor-8 template:

```groovy
android {
    namespace "com.ceegore.riftwarden"
    compileSdk 36

    defaultConfig {
        applicationId "com.ceegore.riftwarden"
        minSdk 24
        targetSdk 36
        versionCode 10000
        versionName "1.0.0"
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}
```

Verify the root plugin version remains in the approved `8.13.x` resolution and the wrapper URL remains `gradle-8.14.x-bin.zip`. Do not upgrade merely because a newer release exists.
