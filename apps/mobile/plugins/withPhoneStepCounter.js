const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Physical activity permission of the phone step counter
 * (modules/phone-steps), in the AppGallery build only
 * (PHONE_STEP_COUNTER=true, see app.config.ts). The Play Store build
 * keeps it removed (withHuaweiHealthManifest.js), as declared in the
 * Play Console.
 */
const PERMISSION = 'android.permission.ACTIVITY_RECOGNITION';

const isPhoneStepCounterEnabled = () =>
  process.env.PHONE_STEP_COUNTER === 'true';

function withPhoneStepCounter(config) {
  if (!isPhoneStepCounterEnabled()) {
    return config;
  }

  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Also drops a removal left in android/ by a previous prebuild
    // without the counter.
    manifest['uses-permission'] = [
      ...(manifest['uses-permission'] || []).filter(
        (permission) => permission.$['android:name'] !== PERMISSION,
      ),
      { $: { 'android:name': PERMISSION } },
    ];

    return config;
  });
}

module.exports = withPhoneStepCounter;
module.exports.isPhoneStepCounterEnabled = isPhoneStepCounterEnabled;
