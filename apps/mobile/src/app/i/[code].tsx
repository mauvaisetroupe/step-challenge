import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
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
import { getSessionToken } from '../../auth/session'
import UserBadge from '../../components/UserBadge'

type State =
  | { name: 'loading' }
  | { name: 'invalid' }
  | { name: 'error'; message: string }
  | { name: 'ready'; preview: InvitationPreview }
  | { name: 'accepting'; preview: InvitationPreview }
  | { name: 'accepted'; friendName: string }

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'friend_limit_reached':
        return "La limite d'amis est atteinte."
    }

    if (error.status === 429) {
      return 'Trop de tentatives. Réessaie dans une minute.'
    }
  }

  console.error('Invitation error:', error)

  return 'Impossible de traiter cette invitation. Vérifie ta connexion.'
}

/**
 * Invitation screen (ADR 0002), opened by an invitation link
 * (https://step.architech.lu/i/K7F3-M9QX, or stepchallenge-dev://i/…
 * in development) or by a code typed in the friends screen.
 */
export default function InvitationScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const [state, setState] = useState<State>({ name: 'loading' })

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

      setState({ name: 'error', message: errorMessage(error) })
    }
  }, [code])

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

      setState({ name: 'error', message: errorMessage(error) })
    }
  }

  const goToLeaderboard = () => router.replace('/leaderboard')

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
        <Text style={styles.title}>Lien d'invitation invalide</Text>
        <Text style={styles.text}>
          Ce lien a expiré ou a été désactivé. Demande un nouveau lien à la
          personne qui t'a invité·e.
        </Text>
        <Pressable style={styles.secondaryButton} onPress={goToLeaderboard}>
          <Text style={styles.secondaryButtonText}>Retour au classement</Text>
        </Pressable>
      </View>
    )
  }

  if (state.name === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{state.message}</Text>
        <Pressable style={styles.primaryButton} onPress={load}>
          <Text style={styles.primaryButtonText}>Réessayer</Text>
        </Pressable>
      </View>
    )
  }

  if (state.name === 'accepted') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>C'est fait !</Text>
        <Text style={styles.text}>
          {state.friendName} et toi êtes maintenant amis : vous apparaissez
          dans le classement l'un de l'autre.
        </Text>
        <Pressable style={styles.primaryButton} onPress={goToLeaderboard}>
          <Text style={styles.primaryButtonText}>Voir le classement</Text>
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
          <Text style={styles.text}>
            C'est ta propre invitation : partage ce lien avec tes amis pour
            qu'ils te rejoignent.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={goToLeaderboard}>
            <Text style={styles.secondaryButtonText}>Retour au classement</Text>
          </Pressable>
        </>
      ) : preview.alreadyFriends ? (
        <>
          <Text style={styles.text}>
            Vous êtes déjà amis.
          </Text>
          <Pressable style={styles.primaryButton} onPress={goToLeaderboard}>
            <Text style={styles.primaryButtonText}>Voir le classement</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.text}>
            {preview.inviter.name} t'invite à devenir amis. Vous verrez vos
            pas respectifs dans le classement.
          </Text>
          <Pressable
            style={[styles.primaryButton, accepting && styles.disabled]}
            onPress={handleAccept}
            disabled={accepting}
          >
            <Text style={styles.primaryButtonText}>
              {accepting ? 'Un instant...' : 'Devenir amis'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={goToLeaderboard}>
            <Text style={styles.secondaryButtonText}>Pas maintenant</Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },

  inviter: {
    alignItems: 'center',
    marginBottom: 24,
  },

  inviterName: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },

  text: {
    fontSize: 16,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
  },

  error: {
    fontSize: 15,
    color: '#DC2626',
    textAlign: 'center',
  },

  primaryButton: {
    marginTop: 24,
    minHeight: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#208AEF',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },

  secondaryButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F1F1',
  },

  secondaryButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },

  disabled: {
    opacity: 0.5,
  },
})
