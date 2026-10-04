import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Extends app.json with per-variant values, so that the development
 * build can be installed next to the Play Store app on the same phone.
 *
 * APP_VARIANT is set by the `development` profile of eas.json and by the
 * `*:dev` scripts of package.json. Without it, the production values
 * of app.json are used unchanged.
 */

const IS_DEV = process.env.APP_VARIANT === 'development'

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!IS_DEV) {
    return config as ExpoConfig
  }

  return {
    ...config,
    name: `${config.name} (dev)`,
    // Distinct deep link scheme: both apps must not claim the same links.
    scheme: `${config.scheme}-dev`,
    android: {
      ...config.android,
      package: `${config.android?.package}.dev`,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: `${config.ios?.bundleIdentifier}.dev`,
    },
  } as ExpoConfig
}
