import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getLeaderboard, getMySteps, type DayStat } from '../../api/steps'
import {
  getHealthConnectLast30Days,
  syncActivityMinutes,
  syncStatsToServer,
} from '../../services/stepSync'
import TabScreenHeader from '../../components/TabScreenHeader'
import StreakCard from '@/components/home/StreakCard'
import WeekRankCard from '@/components/home/WeekRankCard'
import DayProgressRing from '@/components/stats/DayProgressRing'
import {
  computeStreaks,
  computeWeekRank,
  type Streaks,
  type WeekRank,
} from '@/services/insights'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

const DAILY_GOAL = 10_000

/** The whole history: the record streak covers it all. */
const HISTORY_START = '2000-01-01'

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export default function HomeScreen() {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t } = useTranslation()

  const [todaySteps, setTodaySteps] = useState<number | null>(null)
  const [stepsError, setStepsError] = useState<string | null>(null)
  const [rank, setRank] = useState<WeekRank | null>(null)
  const [rankError, setRankError] = useState(false)
  const [streaks, setStreaks] = useState<Streaks | null>(null)
  const [historyError, setHistoryError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const loading = useRef(false)

  const load = useCallback(async () => {
    if (loading.current) {
      return
    }

    loading.current = true

    const todayKey = localDateKey(new Date())
    let healthConnectToday: number | null = null

    try {
      // Health Connect first, then send it to the server before reading
      // the leaderboard and the history, so that they include today.
      if (Platform.OS !== 'web') {
        try {
          // Steps only: shown and sent at once; the activity minutes
          // follow below, without delaying the screen.
          const stats = await getHealthConnectLast30Days({ activityDays: 0 })

          healthConnectToday =
            stats.find((day) => day.date === todayKey)?.steps ?? 0
          setTodaySteps(healthConnectToday)
          setStepsError(null)

          try {
            await syncStatsToServer(stats)
          } catch (err) {
            console.error('Step synchronization error:', err)
          }

          // In the background: the minutes of the last days (30 the
          // first time after the update, ADR 0010).
          syncActivityMinutes(stats).catch((err) => {
            console.error('Activity minutes synchronization error:', err)
          })
        } catch (err) {
          console.error('Health Connect step read error:', err)
          setStepsError(
            err instanceof Error
              ? err.message
              : t('home.healthConnectError'),
          )
        }
      }

      const [board, history] = await Promise.allSettled([
        getLeaderboard('week'),
        getMySteps(HISTORY_START),
      ])

      if (board.status === 'fulfilled') {
        setRank(computeWeekRank(board.value.results))
        setRankError(false)
      } else {
        console.error('Leaderboard read error:', board.reason)
        setRankError(true)
      }

      if (history.status === 'fulfilled') {
        const days: DayStat[] = history.value.filter(
          (day) => day.date !== todayKey,
        )
        const serverToday =
          history.value.find((day) => day.date === todayKey)?.steps ?? 0
        const today = Math.max(serverToday, healthConnectToday ?? 0)

        days.push({ date: todayKey, steps: today })

        if (Platform.OS === 'web') {
          setTodaySteps(today)
        }

        setStreaks(computeStreaks(days, todayKey, DAILY_GOAL))
        setHistoryError(false)
      } else {
        console.error('Step history read error:', history.reason)
        setHistoryError(true)
      }
    } finally {
      loading.current = false
      setLoaded(true)
    }
  }, [t])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <TabScreenHeader title="Step Challenge" />

      {!loaded ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <Text style={styles.subtitle}>{t('home.today')}</Text>

          {stepsError && todaySteps === null ? (
            <Text style={styles.error}>{stepsError}</Text>
          ) : (
            <View style={styles.ring}>
              <DayProgressRing steps={todaySteps ?? 0} goal={DAILY_GOAL} />
            </View>
          )}

          {/* From today to the week: the streak right under the ring
              (today's goal keeps it going), then the friends. */}
          <StreakCard
            streaks={streaks}
            goal={DAILY_GOAL}
            error={historyError}
          />

          <WeekRankCard
            rank={rank}
            error={rankError}
            onOpenLeaderboard={() => router.push('/leaderboard')}
            onInviteFriends={() => router.push('/friends')}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },

    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 16,
    },

    subtitle: {
      color: c.textSecondary,
      fontSize: 18,
      textAlign: 'center',
      marginTop: 8,
    },

    ring: {
      alignItems: 'center',
      marginBottom: 8,
    },

    error: {
      color: c.danger,
      fontSize: 16,
      textAlign: 'center',
      marginVertical: 20,
    },
  })
