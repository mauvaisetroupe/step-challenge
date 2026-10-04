const fs = require('fs');
const path = require('path');
const {
  withAppBuildGradle,
  withDangerousMod,
  withProjectBuildGradle,
} = require('@expo/config-plugins');

// Huawei AppGallery Connect configuration of the app (app id, keys).
// Downloaded from AppGallery Connect, ignored by git: see
// agconnect-services.example.json and huawei/README.md.
const CONFIG_FILE = 'agconnect-services.json';

// EAS builds don't upload git-ignored files: they get the configuration
// from this EAS environment variable, which holds the content of the file.
// (EAS variables of type "file" are not provided to local builds.)
const CONFIG_ENV = 'AGCONNECT_SERVICES_JSON';

/**
 * Content of agconnect-services.json: from the EAS variable, else from the
 * local file. Undefined when neither is available.
 */
function readConfig(projectRoot) {
  const fromEnv = process.env[CONFIG_ENV];

  if (fromEnv) {
    return fromEnv;
  }

  const file = path.join(projectRoot, CONFIG_FILE);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
}

// Same version as com.huawei.agconnect:agconnect-core, pulled by
// @hmscore/react-native-hms-health.
const AGCP_VERSION = '1.9.1.304';

const HUAWEI_REPO = "maven { url 'https://developer.huawei.com/repo/' }";

/**
 * Android Gradle Plugin version used by React Native.
 *
 * The AGConnect Gradle plugin needs an explicit AGP version in the
 * buildscript classpath ("com.android.tools.build:gradle is no set"), while
 * the Expo template leaves it unversioned.
 */
function reactNativeAgpVersion(projectRoot) {
  const catalog = path.join(
    path.dirname(
      require.resolve('react-native/package.json', { paths: [projectRoot] }),
    ),
    'gradle',
    'libs.versions.toml',
  );
  const match = fs
    .readFileSync(catalog, 'utf8')
    .match(/^agp\s*=\s*"([^"]+)"/m);

  if (!match) {
    throw new Error(`withAGConnect: AGP version not found in ${catalog}`);
  }

  return match[1];
}

function withProjectSetup(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    const agp = reactNativeAgpVersion(config.modRequest.projectRoot);

    // The AGConnect plugin is published on the Huawei repository: the
    // buildscript needs it too, not only allprojects.
    if (!/buildscript\s*\{\s*repositories\s*\{[^}]*developer\.huawei\.com/.test(contents)) {
      contents = contents.replace(
        /(buildscript\s*\{\s*repositories\s*\{)/,
        `$1\n    ${HUAWEI_REPO}`,
      );
    }

    contents = contents.replace(
      "classpath('com.android.tools.build:gradle')",
      `classpath('com.android.tools.build:gradle:${agp}')`,
    );

    if (!contents.includes('com.huawei.agconnect:agcp')) {
      contents = contents.replace(
        /(classpath\('com\.android\.tools\.build:gradle[^']*'\))/,
        `$1\n    classpath('com.huawei.agconnect:agcp:${AGCP_VERSION}')`,
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

function withAppSetup(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Applied after the Android plugin, as AGConnect requires.
    if (!contents.includes('com.huawei.agconnect')) {
      contents = contents.replace(
        'apply plugin: "com.android.application"',
        'apply plugin: "com.android.application"\napply plugin: "com.huawei.agconnect"',
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

function withConfigFile(config, content) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      fs.writeFileSync(
        path.join(config.modRequest.platformProjectRoot, 'app', CONFIG_FILE),
        content,
      );
      return config;
    },
  ]);
}

/**
 * Huawei AppGallery Connect setup, required by Huawei Health Kit: copies
 * agconnect-services.json into android/app and applies the AGConnect
 * Gradle plugin, which declares the Huawei app id in the manifest.
 *
 * Without agconnect-services.json (fresh clone, CI), nothing is applied:
 * the app builds, without Huawei Health support.
 */
module.exports = function withAGConnect(config) {
  const projectRoot = config._internal?.projectRoot ?? process.cwd();

  const content = readConfig(projectRoot);

  if (!content) {
    console.warn(
      `withAGConnect: ${CONFIG_FILE} not found (nor $${CONFIG_ENV}), ` +
        'Huawei Health will not work (see agconnect-services.example.json).',
    );
    return config;
  }

  // The file is bound to one package. The development variant
  // (lu.architech.stepchallenge.dev) is not registered in AppGallery
  // Connect: it builds without Huawei Health.
  const registeredPackage = JSON.parse(content).client?.package_name;

  if (registeredPackage !== config.android?.package) {
    console.warn(
      `withAGConnect: ${CONFIG_FILE} is for ${registeredPackage}, not ` +
        `${config.android?.package}: Huawei Health is disabled in this build.`,
    );
    return config;
  }

  config = withProjectSetup(config);
  config = withAppSetup(config);
  config = withConfigFile(config, content);
  return config;
};
