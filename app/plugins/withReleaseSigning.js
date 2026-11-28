// Expo config plugin: lets Codemagic sign and number Android release builds.
//
// `expo prebuild` regenerates android/app/build.gradle on every build, so these
// edits are made here instead of in the generated file:
//   - release builds are signed with the upload keystore Codemagic provides
//     (CM_KEYSTORE_PATH etc.); local builds keep using the debug key
//   - versionCode / versionName come from -PversionCode / -PversionName
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            if (System.getenv("CM_KEYSTORE_PATH")) {
                storeFile file(System.getenv("CM_KEYSTORE_PATH"))
                storePassword System.getenv("CM_KEYSTORE_PASSWORD")
                keyAlias System.getenv("CM_KEY_ALIAS")
                keyPassword System.getenv("CM_KEY_PASSWORD")
            }
        }`;

function edit(gradle) {
  if (gradle.includes('CM_KEYSTORE_PATH')) return gradle;
  const steps = [
    [/versionCode \d+/, 'versionCode((findProperty("versionCode") ?: "1").toInteger())'],
    [/versionName "[^"]*"/, 'versionName((findProperty("versionName") ?: "1.0.0").toString())'],
    [/(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig System.getenv("CM_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug'],
    [/signingConfigs \{/, `signingConfigs {${RELEASE_SIGNING}`],
  ];
  for (const [find, replace] of steps) {
    if (!find.test(gradle)) throw new Error(`withReleaseSigning: couldn't find ${find} in android/app/build.gradle`);
    gradle = gradle.replace(find, replace);
  }
  return gradle;
}

module.exports = (config) => withAppBuildGradle(config, (c) => {
  c.modResults.contents = edit(c.modResults.contents);
  return c;
});
