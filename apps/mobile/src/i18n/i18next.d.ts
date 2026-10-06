import 'i18next'

import type en from './locales/en.json'

/**
 * Translation keys are typed from the English file, the reference
 * (ADR 0007): an unknown key fails the typecheck. scripts/check-i18n.mjs
 * checks that the other languages have the same keys.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: typeof en
    }
  }
}
