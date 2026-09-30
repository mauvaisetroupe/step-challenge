const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withHuaweiMavenRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('https://developer.huawei.com/repo/')) {
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
