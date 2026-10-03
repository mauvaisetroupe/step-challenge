const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHuaweiHealthManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Tell the Android manifest merger to remove entries contributed
    // by the Huawei Health SDK that are not required by Step Challenge.
    // The app only uses Health Kit sign-in and step data reading.
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
      {
        $: {
          'android:name': 'android.permission.ACTIVITY_RECOGNITION',
          'tools:node': 'remove',
        },
      },
      {
        $: {
          'android:name': 'android.permission.ACCESS_FINE_LOCATION',
          'tools:node': 'remove',
        },
      },
      {
        $: {
          'android:name': 'android.permission.BLUETOOTH_ADMIN',
          'tools:node': 'remove',
        },
      },
      {
        $: {
          'android:name': 'android.permission.BLUETOOTH',
          'tools:node': 'remove',
        },
      },
      {
        $: {
          'android:name': 'android.permission.BODY_SENSORS',
          'tools:node': 'remove',
        },
      },
      {
        $: {
          'android:name': 'android.permission.POST_NOTIFICATIONS',
          'tools:node': 'remove',
        },
      },
      {
        $: {
          'android:name': 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
          'tools:node': 'remove',
        },
      },
      {
        $: {
          'android:name': 'android.permission.FOREGROUND_SERVICE',
          'tools:node': 'remove',
        },
      },
      {
        $: {
          'android:name': 'android.permission.WAKE_LOCK',
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