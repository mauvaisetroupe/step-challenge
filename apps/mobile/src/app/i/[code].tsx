import { router, useLocalSearchParams } from 'expo-router'
import type { TFunction } from 'i18next'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { ApiError } from '../../api/client'
import {
  acceptInvitation,
  previewInvitation,
  type InvitationPreview,
} from '../../api/friends'
import { blockUser } from '../../api/moderation'
import { getSessionToken } from '../../auth/session'
import ReportUserModal, {
  type ReportTarget,
} from '../../components/ReportUserModal'
import UserBadge from '../../components/UserBadge'
import { useThemedStyles, type Colors } from '@/theme'

type State =
  | { name: 'loading' }
  | { name: 'invalid' }
  | { name: 'error'; message: string }
  | { name: 'ready'; preview: InvitationPreview }
  | { name: 'accepting'; preview: InvitationPreview }
  | { name: 'accepted'; friendName: string }
  | { name: 'blocked'; inviterName: string }

function errorMessage(error: unknown, t: TFunction) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'friend_limit_reached':
        return t('invitation.errors.friendLimit')
    }

    if (error.status === 429) {
      return t('invitation.errors.tooManyAttempts')
    }
  }

  console.error('Invitation error:', error)

  return t('invitation.errors.generic')
}

/**
 * Invitation screen (ADR 0002), opened by an invitation link
 * (https://step.architech.lu/i/K7F3-M9QX, or stepchallenge-dev://i/…
 * in development) or by a code typed in the friends screen. The inviter
 * may be a stranger (a link that circulated): they can be reported and
 * blocked without accepting (ADR 0004).
 */
export default function InvitationScreen() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()

  const { code } = useLocalSearchParams<{ code: string }>()
  const [state, setState] = useState<State>({ name: 'loading' })
  const [reporting, setReporting] = useState<ReportTarget | null>(null)

  const load = useCallback(async () => {
    setState({ name: 'loading' })

    // Not signed in yet: sign in first, then come back here.
    if (!(await getSessionToken())) {
      router.replace({ pathname: '/sign-in', params: { next: `/i/${code}` } })
      return
    }

    try {
      setState({ name: 'ready', preview: await previewInvitation(code) })
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setState({ name: 'invalid' })
        return
      }

      setState({ name: 'error', message: errorMessage(error, t) })
    }
  }, [code, t])

  useEffect(() => {
    load()
  }, [load])

  const handleAccept = async () => {
    if (state.name !== 'ready') {
      return
    }

    setState({ name: 'accepting', preview: state.preview })

    try {
      const result = await acceptInvitation(code)

      setState({ name: 'accepted', friendName: result.friend.name })
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setState({ name: 'invalid' })
        return
      }

      setState({ name: 'error', message: errorMessage(error, t) })
    }
  }

  const goToLeaderboard = () => router.replace('/leaderboard')

  // Offered by the report modal once the report is sent.
  const blockInviter = async (target: ReportTarget) => {
    await blockUser(target.id)
    setState({ name: 'blocked', inviterName: target.name })
  }

  if (state.name === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (state.name === 'invalid') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('invitation.invalid.title')}</Text>
        <Text style={styles.text}>{t('invitation.invalid.text')}</Text>
        <Pressable style={styles.secondaryButton} onPress={goToLeaderboard}>
          <Text style={styles.secondaryButtonText}>
            {t('invitation.backToLeaderboard')}
          </Text>
        </Pressable>
      </View>
    )
  }

  if (state.name === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{state.message}</Text>
        <Pressable style={styles.primaryButton} onPress={load}>
          <Text style={styles.primaryButtonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    )
  }

  if (state.name === 'blocked') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {t('invitation.blocked.title', { name: state.inviterName })}
        </Text>
        <Text style={styles.text}>{t('invitation.blocked.text')}</Text>
        <Pressable style={styles.secondaryButton} onPress={goToLeaderboard}>
          <Text style={styles.secondaryButtonText}>
            {t('invitation.backToLeaderboard')}
          </Text>
        </Pressable>
      </View>
    )
  }

  if (state.name === 'accepted') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('invitation.accepted.title')}</Text>
        <Text style={styles.text}>
          {t('invitation.accepted.text', { name: state.friendName })}
        </Text>
        <Pressable style={styles.primaryButton} onPress={goToLeaderboard}>
          <Text style={styles.primaryButtonText}>
            {t('invitation.seeLeaderboard')}
          </Text>
        </Pressable>
      </View>
    )
  }

  const { preview } = state
  const accepting = state.name === 'accepting'

  return (
    <View style={styles.container}>
      <View style={styles.inviter}>
        <UserBadge
          userId={preview.inviter.id}
          name={preview.inviter.name}
          size={64}
        />
        <Text style={styles.inviterName}>{preview.inviter.name}</Text>
      </View>

      {preview.isOwnInvitation ? (
        <>
          <Text style={styles.text}>{t('invitation.own')}</Text>
          <Pressable style={styles.secondaryButton} onPress={goToLeaderboard}>
            <Text style={styles.secondaryButtonText}>
            {t('invitation.backToLeaderboard')}
          </Text>
          </Pressable>
        </>
      ) : preview.alreadyFriends ? (
        <>
          <Text style={styles.text}>{t('invitation.alreadyFriends')}</Text>
          <Pressable style={styles.primaryButton} onPress={goToLeaderboard}>
            <Text style={styles.primaryButtonText}>
            {t('invitation.seeLeaderboard')}
          </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.text}>
            {t('invitation.invites', { name: preview.inviter.name })}
          </Text>
          <Pressable
            style={[styles.primaryButton, accepting && styles.disabled]}
            onPress={handleAccept}
            disabled={accepting}
          >
            <Text style={styles.primaryButtonText}>
              {accepting ? t('invitation.accepting') : t('invitation.accept')}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={goToLeaderboard}>
            <Text style={styles.secondaryButtonText}>
              {t('invitation.notNow')}
            </Text>
          </Pressable>
        </>
      )}

      {!preview.isOwnInvitation && (
        <Pressable
          style={styles.reportLink}
          onPress={() =>
            setReporting({
              id: preview.inviter.id,
              name: preview.inviter.name,
              invitationCode: code,
            })
          }
          disabled={accepting}
          hitSlop={8}
        >
          <Text style={styles.reportLinkText}>
            {t('invitation.report')}
          </Text>
        </Pressable>
      )}

      <ReportUserModal
        target={reporting}
        onClose={() => setReporting(null)}
        onBlock={blockInviter}
      />
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },

    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor: c.background,
    },

    inviter: {
      alignItems: 'center',
      marginBottom: 24,
    },

    inviterName: {
      marginTop: 12,
      fontSize: 24,
      fontWeight: '700',
      color: c.text,
    },

    title: {
      fontSize: 24,
      fontWeight: '700',
      color: c.text,
      marginBottom: 12,
      textAlign: 'center',
    },

    text: {
      fontSize: 16,
      lineHeight: 22,
      color: c.textSecondary,
      textAlign: 'center',
    },

    error: {
      fontSize: 15,
      color: c.danger,
      textAlign: 'center',
    },

    primaryButton: {
      marginTop: 24,
      minHeight: 52,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },

    primaryButtonText: {
      color: c.onPrimary,
      fontSize: 17,
      fontWeight: '600',
    },

    secondaryButton: {
      marginTop: 12,
      minHeight: 48,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceAlt,
    },

    secondaryButtonText: {
      color: c.text,
      fontSize: 15,
      fontWeight: '600',
    },

    reportLink: {
      marginTop: 24,
      alignSelf: 'center',
    },

    reportLinkText: {
      fontSize: 14,
      color: c.textSecondary,
      textDecorationLine: 'underline',
    },

    disabled: {
      opacity: 0.5,
    },
  })
