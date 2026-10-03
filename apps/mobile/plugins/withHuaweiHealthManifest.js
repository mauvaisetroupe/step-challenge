const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHuaweiHealthManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Tell the Android manifest merger to remove entries contributed
    // by the Huawei Health SDK. Step Challenge does not use
    // Activity Records or Auto Recorder.
    manifest.$ = {
      ...manifest.$,
      'xmlns:tools': 'http://schemas.android.com/tools',
    };

    manifest['uses-permission'] = [
      ...(manifest['uses-permission'] || []),
      {
        $: {
          'android:name': 'android.permission.FOREGROUND_SERVICE_HEALTH',
          'tools:node': 'remove',
        },
      },
    ];

    const application = manifest.application?.[0];

    if (application) {
      application.service = [
        ...(application.service || []),
        {
          $: {
            'android:name':
              'com.huawei.hms.rn.health.kits.activityrecords.util.ActivityRecordBackgroundService',
            'tools:node': 'remove',
          },
        },
        {
          $: {
            'android:name':
              'com.huawei.hms.rn.health.kits.autorecorder.utils.AutoRecorderBackgroundService',
            'tools:node': 'remove',
          },
        },
      ];
    }

    return config;
  });
};
