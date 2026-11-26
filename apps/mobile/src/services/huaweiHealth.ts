import {
  HmsConsentsController,
  HmsHealthAccount,
} from '@hmscore/react-native-hms-health'

import type { DayStat } from '../api/steps'
import {
  buildHourlyRequest,
  buildPolymerizeRequest,
  countHoursWithSteps,
  huaweiAccessReasonOf,
  parsePolymerizeResponse,
  POLYMERIZE_URL,
} from './huaweiRest'

/**
 * Huawei Health, read through the Health Kit REST API (ADR 0013).
 *
 * The SDK is only used to sign in: its data calls go through an HMS
 * Core process that Android freezes, and they then fail with 50011
 * (docs/explanation/huawei-integration.md, section 16). The REST API
 * reads Huawei's cloud, filled by the Huawei Health app.
 */

type HuaweiResult = {
  isSuccess?: boolean
  body?: { accessToken?: string; authorizedScopes?: string[] }
  [key: string]: unknown
}

const STEP_READ_SCOPE =
  'https://www.huawei.com/healthkit/step.read'

/** App ID in AppGallery Connect, required by the REST API. */
const HUAWEI_APP_ID = '118922449'

const HISTORY_DAYS = 30

/**
 * Why Step Challenge cannot read HUAWEI Health until the user acts
 * (docs/reference/huawei-verification.md, scenarios 3.3 to 3.5):
 *
 * - notAuthorized: consent refused, withdrawn in the HUAWEI Health app,
 *   or given without the step read permission;
 * - switchOff: the HUAWEI Health Kit switch is off in the HUAWEI Health
 *   app (Me → Privacy management).
 */
export type HuaweiAccessReason = 'notAuthorized' | 'switchOff'

export class HuaweiAccessError extends Error {
  constructor(
    readonly reason: HuaweiAccessReason,
    message: string,
  ) {
    super(message)
    this.name = 'HuaweiAccessError'
  }
}

/**
 * Signs in to HUAWEI with the step read scope and returns the access
 * token (valid about an hour). Shows the consent screen when consent is
 * missing (first time, or withdrawn in the HUAWEI Health app); otherwise
 * it returns a fresh token without any screen.
 */
export async function signInHuaweiHealth() {
  let result: HuaweiResult

  try {
    result = (await HmsHealthAccount.signIn([
      STEP_READ_SCOPE,
    ])) as HuaweiResult
  } catch (error) {
    throw new HuaweiAccessError(
      'notAuthorized',
      `HUAWEI Health sign-in failed: ${
        error instanceof Error ? error.message : JSON.stringify(error)
      }`,
    )
  }

  const token = result.body?.accessToken
  const scopes = result.body?.authorizedScopes ?? []

  if (!result.isSuccess || !token) {
    throw new HuaweiAccessError(
      'notAuthorized',
      `HUAWEI Health authorization failed: ${JSON.stringify({
        isSuccess: result.isSuccess,
        errorMessage: result.errorMessage,
        returnCode: result.returnCode,
      })}`,
    )
  }

  // Consent given with the step permission unticked.
  if (!scopes.includes(STEP_READ_SCOPE)) {
    throw new HuaweiAccessError(
      'notAuthorized',
      `HUAWEI Health step permission not granted: ${scopes.join(', ')}`,
    )
  }

  return { token, scopes }
}

/**
 * The library's typings miss the native method (HmsConsentsController
 * in android/, kits/consents).
 */
const consents = HmsConsentsController as unknown as {
  cancelAuthorizationAll(deleteData: boolean): Promise<HuaweiResult>
}

/** Beyond this, HMS Core is probably frozen (ADR 0013): give up. */
const REVOKE_TIMEOUT_MS = 15_000

/**
 * Cancels every Health Kit scope granted to Step Challenge, without
 * deleting data (the app writes none): the next sign-in asks for
 * consent again. Goes through HMS Core's Health Kit process, the one
 * Android may freeze, hence the time limit.
 */
export async function revokeHuaweiHealth() {
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Huawei Health revocation timed out')),
      REVOKE_TIMEOUT_MS,
    )
  })

  try {
    const result = (await Promise.race([
      consents.cancelAuthorizationAll(false),
      timeout,
    ])) as HuaweiResult

    if (!result?.isSuccess) {
      throw new Error(
        `Huawei Health revocation failed: ${JSON.stringify(result)}`,
      )
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Daily steps of the last 30 days, today included, oldest first.
 *
 * Huawei serves what the Huawei Health app has uploaded: the last
 * minutes of today may be missing.
 */
export async function getHuaweiLast30Days(): Promise<DayStat[]> {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - (HISTORY_DAYS - 1))

  const request = buildPolymerizeRequest(start, end)
  let token = (await signInHuaweiHealth()).token
  let response = await postPolymerize(request, token)

  // An expired or revoked token: sign in again, once.
  if (response.status === 401) {
    token = (await signInHuaweiHealth()).token
    response = await postPolymerize(request, token)
  }

  if (!response.ok) {
    throw await readFailure(response)
  }

  return parsePolymerizeResponse(await response.json(), request)
}

/**
 * Today's hours, and those with steps in Huawei's cloud (diagnostic:
 * does this user's device upload more than daily totals?).
 */
export async function getHuaweiTodayHourlyDetail() {
  const { token } = await signInHuaweiHealth()
  const response = await postPolymerize(buildHourlyRequest(new Date()), token)

  if (!response.ok) {
    throw await readFailure(response)
  }

  return countHoursWithSteps(await response.json())
}

/** Error of a failed REST read, typed when the user can fix it. */
async function readFailure(response: Response) {
  const body = await response.text()
  const message = `HUAWEI Health read failed: HTTP ${response.status} ${body}`
  const reason = huaweiAccessReasonOf(response.status, body)

  return reason ? new HuaweiAccessError(reason, message) : new Error(message)
}

function postPolymerize(request: object, token: string) {
  return fetch(POLYMERIZE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-client-id': HUAWEI_APP_ID,
      'x-version': '1.0',
      'x-caller-trace-id': `step-challenge-${Date.now()}`,
    },
    body: JSON.stringify(request),
  })
}
