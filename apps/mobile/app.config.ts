import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Extends app.json with per-variant values, so that the development
 * build can be installed next to the Play Store app on the same phone.
 *
 * APP_VARIANT is set by the `development` profile of eas.json and by the
 * `*:dev` scripts of package.json. Without it, the production values
 * of app.json are used unchanged.
 *
 * PHONE_STEP_COUNTER=true (the `appgallery` profile) adds the phone step
 * counter, read when Health Connect is missing (services/phoneSteps.ts),
 * with its permission (plugins/withPhoneStepCounter.js). The Play Store
 * build has neither.
 *
 * SIMULATE_NO_HEALTH_CONNECT=true, development build only, behaves as on
 * a phone without Health Connect (a Huawei phone), to test it on a Pixel.
 */

const IS_DEV = process.env.APP_VARIANT === 'development'
const PHONE_STEP_COUNTER = process.env.PHONE_STEP_COUNTER === 'true'
const SIMULATE_NO_HEALTH_CONNECT =
  IS_DEV && process.env.SIMULATE_NO_HEALTH_CONNECT === 'true'

export default ({ config }: ConfigContext): ExpoConfig => {
  const extra = {
    ...config.extra,
    phoneStepCounter: PHONE_STEP_COUNTER,
    simulateNoHealthConnect: SIMULATE_NO_HEALTH_CONNECT,
  }

  if (!IS_DEV) {
    return { ...config, extra } as ExpoConfig
  }

  return {
    ...config,
    extra,
    name: `${config.name} (dev)`,
    // Distinct deep link scheme: both apps must not claim the same links.
    scheme: `${config.scheme}-dev`,
    android: {
      ...config.android,
      package: `${config.android?.package}.dev`,
      // https://step.architech.lu/i/… links belong to the production app
      // (assetlinks.json); the dev build opens invitations through its
      // own scheme: stepchallenge-dev://i/<code>
      intentFilters: [],
    },
    ios: {
      ...config.ios,
      bundleIdentifier: `${config.ios?.bundleIdentifier}.dev`,
    },
  } as ExpoConfig
}
