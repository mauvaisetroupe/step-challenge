import type { FastifyPluginAsync } from 'fastify'

import {
  formatInvitationCode,
  normalizeInvitationCode,
} from '../friends/invitationCode.js'

/**
 * Invitation links (ADR 0002): https://step.architech.lu/i/K7F3-M9QX
 *
 * - With the app installed, Android opens the link directly in the app
 *   (App Links), verified through /.well-known/assetlinks.json.
 * - Otherwise, the browser shows the page below: install the app, then
 *   open the link again or type the code.
 */

const ANDROID_PACKAGE = 'lu.architech.stepchallenge'

const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`

/**
 * SHA-256 fingerprints of the certificates that sign the production
 * app: the Google Play app signing key (installs from the Store) and
 * the upload key (local builds installed directly). The development
 * variant is deliberately not listed: it uses its own URL scheme, so
 * that both apps do not claim the same links on a developer's phone.
 */
const SIGNING_CERT_FINGERPRINTS = [
  // Play app signing key (Play Console → App signing)
  '34:CE:57:9C:8E:EA:EB:1B:72:16:51:45:64:81:3D:82:2E:B7:71:4D:28:E7:B0:C7:27:61:48:DC:C1:A2:04:E5',
  // Upload key (EAS credentials)
  '71:B4:F8:FB:48:F2:F5:87:5F:D6:89:BD:92:F4:6B:55:4A:8D:42:EA:29:8E:FF:8F:EF:16:52:C9:EF:83:6D:C8',
]

export const ASSET_LINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE,
      sha256_cert_fingerprints: SIGNING_CERT_FINGERPRINTS,
    },
  },
]

function invitationPage(code: string | null, host: string) {
  const formatted = code ? formatInvitationCode(code) : null

  // Opens the app when installed, the Play Store otherwise.
  const intentUrl = formatted
    ? `intent://${host}/i/${formatted}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`
    : null

  const body = formatted
    ? `
        <h1>Tu es invité·e sur Step Challenge</h1>
        <p class="lead">
          Un ami t'invite à comparer vos pas de la semaine et du mois.
        </p>

        <a class="button" href="${intentUrl}">Ouvrir l'invitation dans l'application</a>

        <h2>Pas encore l'application ?</h2>
        <ol>
          <li>Installe <a href="${PLAY_STORE_URL}">Step Challenge sur Google Play</a>.</li>
          <li>Connecte-toi avec ton compte Google.</li>
          <li>Rouvre ce lien, ou saisis ce code dans
            <em>Classement → Amis → J'ai un code</em> :</li>
        </ol>

        <p class="code">${formatted}</p>
        <p class="hint">Ce code est valable 7 jours.</p>
      `
    : `
        <h1>Lien d'invitation invalide</h1>
        <p class="lead">
          Ce lien ne correspond à aucune invitation. Demande un nouveau lien
          à la personne qui t'a invité·e.
        </p>
        <p><a href="${PLAY_STORE_URL}">Step Challenge sur Google Play</a></p>
      `

  return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">
    <title>Invitation — Step Challenge</title>
    <style>
        :root {
            color-scheme: light;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            line-height: 1.6;
            color: #2b2522;
            background: #fdf8f5;
        }
        body { margin: 0; padding: 2rem 1rem; }
        main {
            max-width: 560px;
            margin: 0 auto;
            background: #fff;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        }
        h1 { margin-top: 0; line-height: 1.2; }
        h2 { margin-top: 2rem; font-size: 1.15rem; }
        .lead { color: #6f6661; }
        .button {
            display: block;
            margin: 1.5rem 0;
            padding: 0.9rem 1rem;
            border-radius: 10px;
            background: #208aef;
            color: #fff;
            text-align: center;
            font-weight: 600;
            text-decoration: none;
        }
        .code {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 1.8rem;
            letter-spacing: 0.15em;
            text-align: center;
            background: #f1f7fe;
            border-radius: 10px;
            padding: 0.75rem;
        }
        .hint { color: #6f6661; font-size: 0.9rem; text-align: center; }
        a { color: #1a6fc4; }
        footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #eee;
            color: #6f6661;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <main>
        ${body}
        <footer>
            <a href="/">Step Challenge</a> · <a href="/privacy.html">Confidentialité</a>
        </footer>
    </main>
</body>
</html>
`
}

export type AppLinkRoutesOptions = {
  /** Host of the invitation links, e.g. step.architech.lu */
  host: string
}

const appLinkRoutes: FastifyPluginAsync<AppLinkRoutesOptions> = async (
  app,
  { host },
) => {
  // Served by a route: the static file plugin ignores dot directories.
  app.get('/.well-known/assetlinks.json', async (_request, reply) => {
    return reply.type('application/json').send(ASSET_LINKS)
  })

  app.get<{ Params: { code: string } }>(
    '/i/:code',
    async (request, reply) => {
      // Only a normalized code (Crockford alphabet) is ever inserted in
      // the page, so the input cannot inject HTML.
      const code = normalizeInvitationCode(request.params.code)

      return reply
        .code(code ? 200 : 404)
        .type('text/html; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .send(invitationPage(code, host))
    },
  )
}

export default appLinkRoutes
