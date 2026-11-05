import {
  DAILY_GOAL,
  REGULAR_MONTH_DAYS,
  WEEKLY_ACTIVITY_GOAL,
  challengeOfMonth,
  type MonthlyChallenge,
} from './catalogue.js'
import { startOfWeekKey } from './dates.js'

/**
 * Badge texts, in French and English. The server sends them translated
 * (exception to ADR 0007, noted there): a badge added to the catalogue
 * shows without a new version of the app.
 */

export type Locale = 'fr' | 'en'

export type BadgeTexts = {
  name: string
  /** "Week of November 2", "November 2026"; null outside periods. */
  period: string | null
  description: string
}

/** First language of Accept-Language: French, or English otherwise. */
export function localeOf(acceptLanguage: string | undefined): Locale {
  return acceptLanguage?.trim().toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

type Strings = {
  day: (steps: string) => [string, string]
  total: (millions: string, plural: boolean) => [string, string]
  streak: (days: number) => [string, string]
  streakEvery: (days: number) => [string, string]
  nonSedentaryDay: [string, string]
  week: Record<string, [string, string]>
  month: (steps: string) => [string, string]
  regular: [string, string]
  perfect: [string, string]
  challenge: string
  challenges: Record<MonthlyChallenge, string>
  ranking: Record<string, [string, string]>
  weekOf: (date: string) => string
}

const STRINGS: Record<Locale, (format: (n: number) => string) => Strings> = {
  fr: (format) => ({
    day: (steps) => [`${steps} pas en un jour`, `Marcher ${steps} pas en une journée.`],
    total: (millions, plural) => {
      const name = `${millions} million${plural ? 's' : ''} de pas`

      return [name, `Cumuler ${name} depuis ton arrivée sur Step Challenge.`]
    },
    streak: (days) => [
      `${days} jours d'affilée`,
      `Atteindre ${format(DAILY_GOAL)} pas ${days} jours de suite.`,
    ],
    streakEvery: (days) => [
      `Série de ${days} jours`,
      `Gagné à chaque bloc de ${days} jours d'affilée à ${format(DAILY_GOAL)} pas ou plus.`,
    ],
    nonSedentaryDay: [
      'Journée non sédentaire',
      `Une journée terminée à ${format(DAILY_GOAL)} pas ou plus, sans aucune période d'inactivité.`,
    ],
    week: {
      'week.70000': ["Semaine à l'objectif", `${format(70_000)} pas dans la semaine.`],
      'week.100000': ['Grosse semaine', `${format(100_000)} pas dans la semaine.`],
      'week.active': [
        'Semaine active',
        `Un score d'activité de ${WEEKLY_ACTIVITY_GOAL} dans la semaine, la recommandation de l'OMS.`,
      ],
    },
    month: (steps) => [`Mois à ${steps} pas`, `${steps} pas dans le mois.`],
    regular: [
      'Mois régulier',
      `${REGULAR_MONTH_DAYS} jours à ${format(DAILY_GOAL)} pas ou plus dans le mois.`,
    ],
    perfect: ['Mois parfait', `${format(DAILY_GOAL)} pas ou plus tous les jours du mois.`],
    challenge: 'Défi du mois',
    challenges: {
      days15000: `5 jours à ${format(15_000)} pas ou plus dans le mois.`,
      activeWeeks: `4 semaines actives (score d'activité de ${WEEKLY_ACTIVITY_GOAL}) dans le mois.`,
      weekendDays: `8 jours de week-end à ${format(DAILY_GOAL)} pas ou plus dans le mois.`,
      streak14: 'Une série de 14 jours commencée dans le mois.',
      days20000: `3 jours à ${format(20_000)} pas ou plus dans le mois.`,
      nonSedentaryDay: 'Une journée non sédentaire dans le mois.',
    },
    ranking: {
      'ranking.week.first': ['Vainqueur de la semaine', 'Premier du classement de la semaine entre amis.'],
      'ranking.week.podium': ['Podium de la semaine', '2ᵉ ou 3ᵉ du classement de la semaine entre amis.'],
      'ranking.month.first': ['Vainqueur du mois', 'Premier du classement du mois entre amis.'],
      'ranking.month.podium': ['Podium du mois', '2ᵉ ou 3ᵉ du classement du mois entre amis.'],
    },
    weekOf: (date) => `Semaine du ${date}`,
  }),
  en: (format) => ({
    day: (steps) => [`${steps} steps in a day`, `Walk ${steps} steps in one day.`],
    total: (millions) => {
      const name = `${millions} million steps`

      return [name, `Walk ${name} since joining Step Challenge.`]
    },
    streak: (days) => [
      `${days} days in a row`,
      `Reach ${format(DAILY_GOAL)} steps ${days} days in a row.`,
    ],
    streakEvery: (days) => [
      `${days}-day streak`,
      `Earned for every ${days} days in a row at ${format(DAILY_GOAL)} steps or more.`,
    ],
    nonSedentaryDay: [
      'Non-sedentary day',
      `A finished day at ${format(DAILY_GOAL)} steps or more, without any inactive period.`,
    ],
    week: {
      'week.70000': ['Goal week', `${format(70_000)} steps in the week.`],
      'week.100000': ['Big week', `${format(100_000)} steps in the week.`],
      'week.active': [
        'Active week',
        `An activity score of ${WEEKLY_ACTIVITY_GOAL} in the week, the WHO recommendation.`,
      ],
    },
    month: (steps) => [`${steps}-step month`, `${steps} steps in the month.`],
    regular: [
      'Regular month',
      `${REGULAR_MONTH_DAYS} days at ${format(DAILY_GOAL)} steps or more in the month.`,
    ],
    perfect: ['Perfect month', `${format(DAILY_GOAL)} steps or more every day of the month.`],
    challenge: 'Challenge of the month',
    challenges: {
      days15000: `5 days at ${format(15_000)} steps or more in the month.`,
      activeWeeks: `4 active weeks (activity score of ${WEEKLY_ACTIVITY_GOAL}) in the month.`,
      weekendDays: `8 weekend days at ${format(DAILY_GOAL)} steps or more in the month.`,
      streak14: 'A 14-day streak started in the month.',
      days20000: `3 days at ${format(20_000)} steps or more in the month.`,
      nonSedentaryDay: 'A non-sedentary day in the month.',
    },
    ranking: {
      'ranking.week.first': ['Winner of the week', 'First of the weekly leaderboard among friends.'],
      'ranking.week.podium': ['Podium of the week', '2nd or 3rd of the weekly leaderboard among friends.'],
      'ranking.month.first': ['Winner of the month', 'First of the monthly leaderboard among friends.'],
      'ranking.month.podium': ['Podium of the month', '2nd or 3rd of the monthly leaderboard among friends.'],
    },
    weekOf: (date) => `Week of ${date}`,
  }),
}

function periodLabel(locale: Locale, strings: Strings, occurrence: string) {
  if (/^\d{4}-W\d{2}$/.test(occurrence)) {
    const start = new Date(`${startOfWeekKey(occurrence)}T00:00:00Z`)

    return strings.weekOf(
      new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(start),
    )
  }

  if (/^\d{4}-\d{2}$/.test(occurrence)) {
    const label = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${occurrence}-01T00:00:00Z`))

    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  return null
}

/**
 * Texts of a badge. The occurrence gives the period of a week or month
 * badge, and the challenge of a month. Null for a badge this version
 * does not know.
 */
export function badgeTexts(
  locale: Locale,
  badgeId: string,
  occurrence = '',
): BadgeTexts | null {
  const numberFormat = new Intl.NumberFormat(locale)
  const format = (n: number) => numberFormat.format(n)
  const strings = STRINGS[locale](format)
  const [family, rest] = badgeId.split(/\.(.*)/s)
  const number = Number(rest)
  let texts: [string, string] | undefined

  if (family === 'day' && number) {
    texts = strings.day(format(number))
  } else if (family === 'total' && number) {
    texts = strings.total(format(number / 1_000_000), number >= 2_000_000)
  } else if (family === 'streak' && number) {
    texts = strings.streak(number)
  } else if (family === 'streak' && rest?.startsWith('every')) {
    texts = strings.streakEvery(Number(rest.slice('every'.length)))
  } else if (badgeId === 'activity.nonSedentaryDay') {
    texts = strings.nonSedentaryDay
  } else if (family === 'week') {
    texts = strings.week[badgeId]
  } else if (family === 'month' && number) {
    texts = strings.month(format(number))
  } else if (badgeId === 'month.regular') {
    texts = strings.regular
  } else if (badgeId === 'month.perfect') {
    texts = strings.perfect
  } else if (badgeId === 'month.challenge' && occurrence) {
    texts = [strings.challenge, strings.challenges[challengeOfMonth(occurrence)]]
  } else if (family === 'ranking') {
    texts = strings.ranking[badgeId]
  }

  if (!texts) {
    return null
  }

  return {
    name: texts[0],
    period: periodLabel(locale, strings, occurrence),
    description: texts[1],
  }
}
