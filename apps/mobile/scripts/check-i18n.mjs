// Checks the translation files against the English one, the reference
// (ADR 0007): same keys, the plural forms each language needs, the same
// {{values}} and <b> tags. Run with `npm run check:i18n`.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = new URL('../src/i18n/locales/', import.meta.url).pathname
const REFERENCE = 'en'
const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other']
const SUFFIX = new RegExp(`_(ordinal_)?(${CATEGORIES.join('|')})$`)

function flatten(tree, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') {
      out[prefix + key] = value
    } else {
      flatten(value, `${prefix}${key}.`, out)
    }
  }

  return out
}

/** { base: { kind: 'plain' | 'cardinal' | 'ordinal', texts: { form: text } } } */
function group(messages, file, errors) {
  const groups = {}

  for (const [key, text] of Object.entries(messages)) {
    const match = key.match(SUFFIX)
    const base = match ? key.slice(0, -match[0].length) : key
    const kind = match ? (match[1] ? 'ordinal' : 'cardinal') : 'plain'
    const entry = (groups[base] ??= { kind, texts: {} })

    if (entry.kind !== kind) {
      errors.push(`${file}: ${base} mixes plain, plural and ordinal keys`)
    }

    entry.texts[match ? match[2] : ''] = text
  }

  return groups
}

const values = (text) => [...text.matchAll(/\{\{\s*(\w+)/g)].map((m) => m[1])
const tags = (text) => (text.match(/<\/?b>/g) ?? []).length

function signature(texts) {
  const names = new Set(Object.values(texts).flatMap(values))
  // A plural form may spell the number ("One day"): count is optional.
  names.delete('count')
  return [...names].sort().join(',')
}

const errors = []
const files = readdirSync(DIR).filter((file) => file.endsWith('.json'))
const load = (file) => flatten(JSON.parse(readFileSync(join(DIR, file), 'utf8')))
const reference = group(load(`${REFERENCE}.json`), `${REFERENCE}.json`, errors)

for (const file of files) {
  const language = file.replace(/\.json$/, '')
  const groups = language === REFERENCE ? reference : group(load(file), file, errors)

  for (const [base, entry] of Object.entries(groups)) {
    const expected = reference[base]

    if (!expected) {
      errors.push(`${file}: ${base} is not in ${REFERENCE}.json`)
      continue
    }

    if (entry.kind !== expected.kind) {
      errors.push(`${file}: ${base} is ${entry.kind}, ${expected.kind} in ${REFERENCE}.json`)
      continue
    }

    if (entry.kind !== 'plain') {
      const needed = new Intl.PluralRules(language, {
        type: entry.kind,
      }).resolvedOptions().pluralCategories

      for (const form of needed) {
        if (!(form in entry.texts)) {
          errors.push(`${file}: ${base} misses the "${form}" form`)
        }
      }

      for (const form of Object.keys(entry.texts)) {
        if (!needed.includes(form)) {
          errors.push(`${file}: ${base} has a "${form}" form, unused in ${language}`)
        }
      }
    }

    if (signature(entry.texts) !== signature(expected.texts)) {
      errors.push(`${file}: ${base} values {{${signature(entry.texts)}}}, {{${signature(expected.texts)}}} in ${REFERENCE}.json`)
    }

    for (const [form, text] of Object.entries(entry.texts)) {
      if (tags(text) !== tags(Object.values(expected.texts)[0])) {
        errors.push(`${file}: ${base}${form && `_${form}`} has not the same <b> tags as ${REFERENCE}.json`)
      }
    }
  }

  for (const base of Object.keys(reference)) {
    if (!groups[base]) {
      errors.push(`${file}: ${base} is missing`)
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Translations OK: ${files.join(', ')}`)
