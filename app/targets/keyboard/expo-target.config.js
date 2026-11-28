// The Saytwice iPhone keyboard (an iOS keyboard extension, built by @bacons/apple-targets on prebuild).
// Bundle ID: ca.notacult.apps.saytwice.keyboard. It shares the App Group below with the main app,
// which is how the keyboard knows the user's id, Pro status and the backend address.

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'keyboard',
  name: 'SaytwiceKeyboard',
  displayName: 'Saytwice',
  bundleIdentifier: '.keyboard',
  deploymentTarget: '16.4',
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
