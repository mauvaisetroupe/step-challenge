const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withHuaweiMavenRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Checks the allprojects block itself: withAGConnect also adds the
    // repository to the buildscript block.
    if (
      !/allprojects\s*\{\s*repositories\s*\{[^}]*developer\.huawei\.com/.test(
        contents,
      )
    ) {
      contents = contents.replace(
        `allprojects {
  repositories {`,
        `allprojects {
  repositories {
    maven { url 'https://developer.huawei.com/repo/' }`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
