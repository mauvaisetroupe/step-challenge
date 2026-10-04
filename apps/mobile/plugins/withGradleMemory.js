const { withGradleProperties } = require('@expo/config-plugins');

// The Expo template gives Gradle -Xmx2048m -XX:MaxMetaspaceSize=512m, too
// little since the AGConnect Gradle plugin was added: release builds failed
// with "OutOfMemoryError: Metaspace" in lint and ART profile tasks, which
// run inside the Gradle daemon.
const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (config) => {
    const properties = config.modResults;
    const existing = properties.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs',
    );

    if (existing) {
      existing.value = JVM_ARGS;
    } else {
      properties.push({
        type: 'property',
        key: 'org.gradle.jvmargs',
        value: JVM_ARGS,
      });
    }

    return config;
  });
};
