import {
    HmsDataController,
    HmsHealthAccount,
    HmsSettingController,
} from '@hmscore/react-native-hms-health'

type HuaweiResult = {
  isSuccess?: boolean
  [key: string]: unknown
}

const STEP_READ_SCOPE =
  'https://www.huawei.com/healthkit/step.read'

const STEP_TOTAL_DATA_TYPE =
  'DT_CONTINUOUS_STEPS_TOTAL'

export async function configureHuaweiHealth() {
  const signInResult =
    (await HmsHealthAccount.signIn([
      STEP_READ_SCOPE,
    ])) as HuaweiResult

  if (!signInResult.isSuccess) {
    throw new Error(
      `Huawei Health authorization failed: ${JSON.stringify(signInResult)}`,
    )
  }

  const authorization =
    (await HmsSettingController.getHealthAppAuthorization()) as HuaweiResult

  if (!authorization.isSuccess) {
    const result =
      (await HmsSettingController.checkHealthAppAuthorization()) as HuaweiResult

    if (!result.isSuccess) {
      throw new Error(
        `Huawei Health Service Kit authorization failed: ${JSON.stringify(result)}`,
      )
    }
  }

  const initialization =
    (await HmsDataController.initDataController()) as HuaweiResult

  if (!initialization.isSuccess) {
    throw new Error(
      `Huawei Health Data Controller initialization failed: ${JSON.stringify(initialization)}`,
    )
  }

  return true
}

export async function getHuaweiTodaySteps() {
  const initialization =
    (await HmsDataController.initDataController()) as HuaweiResult

  if (!initialization.isSuccess) {
    throw new Error(
      `Huawei Health Data Controller initialization failed: ${JSON.stringify(initialization)}`,
    )
  }

  const result =
    (await HmsDataController.readTodaySummation({
      dataType: STEP_TOTAL_DATA_TYPE,
    })) as HuaweiResult

  if (!result.isSuccess) {
    throw new Error(
      `Huawei Health steps read failed: ${JSON.stringify(result)}`,
    )
  }

  return Number(
    (result.data as Array<{ value?: number }> | undefined)?.[0]?.value ?? 0,
  )
}
