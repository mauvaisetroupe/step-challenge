import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '../api/client'
import {
  createInvitation,
  displayName,
  listFriends,
  listInvitations,
  removeFriend,
  removeFriendAlias,
  revokeInvitation,
  setFriendAlias,
  type ActiveInvitation,
  type Friend,
} from '../api/friends'
import {
  blockUser,
  listBlocks,
  unblockUser,
  type BlockedUser,
} from '../api/moderation'
import ActionSheet from '../components/ActionSheet'
import RenameFriendModal from '../components/RenameFriendModal'
import ReportUserModal, {
  type ReportTarget,
} from '../components/ReportUserModal'
import UserBadge from '../components/UserBadge'

/**
 * Friends screen (ADR 0002): invite friends with a link, accept a code,
 * rename (alias) or remove a friend, list and revoke my active
 * invitation links. Report, block and unblock (ADR 0004). Opened from
 * the leaderboard.
 */
export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [invitations, setInvitations] = useState<ActiveInvitation[]>([])
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [codeInputVisible, setCodeInputVisible] = useState(false)
  const [code, setCode] = useState('')
  const [renaming, setRenaming] = useState<Friend | null>(null)
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<BlockedUser[]>([])
  const [unblockingId, setUnblockingId] = useState<string | null>(null)
  const [actionsFor, setActionsFor] = useState<Friend | null>(null)
  const [reporting, setReporting] = useState<ReportTarget | null>(null)

  // A failure only hides the list: the rest of the screen still works.
  const loadInvitations = useCallback(async () => {
    try {
      setInvitations(await listInvitations())
    } catch (err) {
      console.error('Invitations load error:', err)
    }
  }, [])

  const loadBlocks = useCallback(async () => {
    try {
      setBlocked(await listBlocks())
    } catch (err) {
      console.error('Blocks load error:', err)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Loaded independently: an invitations or blocks error must not be
    // reported as a friends error.
    loadInvitations()
    loadBlocks()

    try {
      setFriends(await listFriends())
    } catch (err) {
      console.error('Friends load error:', err)
      setError('Impossible de charger tes amis.')
    } finally {
      setLoading(false)
    }
  }, [loadInvitations, loadBlocks])

  // Reload when coming back, e.g. after accepting an invitation.
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const handleInvite = async () => {
    setInviting(true)
    setError(null)

    try {
      const invitation = await createInvitation()

      await Share.share({
        message:
          'Rejoins-moi sur Step Challenge pour comparer nos pas ! ' +
          `Ouvre ce lien (valable 7 jours) : ${invitation.url}`,
      })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'too_many_invitations') {
        setError(
          "Tu as déjà trop de liens d'invitation actifs. Désactives-en un ci-dessous, ou attends qu'il expire.",
        )
      } else {
        console.error('Invitation error:', err)
        setError("Impossible de créer un lien d'invitation.")
      }
    } finally {
      setInviting(false)
      // The new link appears in the list, even if sharing was cancelled.
      loadInvitations()
    }
  }

  const confirmRevoke = (invitation: ActiveInvitation) => {
    Alert.alert(
      'Désactiver ce lien ?',
      "Plus personne ne pourra l'utiliser pour devenir ton ami. Les amis qui l'ont déjà accepté restent tes amis.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: async () => {
            setRevokingId(invitation.id)

            try {
              await revokeInvitation(invitation.id)
            } catch (err) {
              // Already revoked (double tap) or expired meanwhile: the
              // link is inactive anyway, the reload removes it.
              if (!(err instanceof ApiError && err.status === 404)) {
                console.error('Revoke invitation error:', err)
                setError('Impossible de désactiver ce lien.')
              }
            } finally {
              await loadInvitations()
              setRevokingId(null)
            }
          },
        },
      ],
    )
  }

  const handleCode = () => {
    const trimmed = code.trim()

    if (trimmed) {
      setCode('')
      setCodeInputVisible(false)
      router.push({ pathname: '/i/[code]', params: { code: trimmed } })
    }
  }

  const confirmRemove = (friend: Friend) => {
    Alert.alert(
      `Retirer ${displayName(friend)} ?`,
      'Vous ne verrez plus vos pas respectifs. Tes liens d\'invitation encore actifs seront désactivés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(friend.id)
              await load()
            } catch (err) {
              console.error('Remove friend error:', err)
              setError('Impossible de retirer cet ami.')
            }
          },
        },
      ],
    )
  }

  const confirmBlock = (target: { id: string; name: string }) => {
    Alert.alert(
      `Bloquer ${target.name} ?`,
      `Vous ne serez plus amis, et ${target.name} ne pourra plus devenir ton ami, même avec un lien d'invitation. ${target.name} n'est pas prévenu.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bloquer',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(target.id)
              await load()
            } catch (err) {
              console.error('Block error:', err)
              setError('Impossible de bloquer cette personne.')
            }
          },
        },
      ],
    )
  }

  // Offered by the report modal once the report is sent.
  const blockReported = async (target: ReportTarget) => {
    await blockUser(target.id)
    await load()
  }

  const confirmUnblock = (user: BlockedUser) => {
    Alert.alert(
      `Débloquer ${user.name} ?`,
      'Vous ne redevenez pas amis automatiquement : il faudra un nouveau lien d\'invitation.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Débloquer',
          onPress: async () => {
            setUnblockingId(user.userId)

            try {
              await unblockUser(user.userId)
            } catch (err) {
              // Already unblocked (double tap): the reload shows it.
              if (!(err instanceof ApiError && err.status === 404)) {
                console.error('Unblock error:', err)
                setError('Impossible de débloquer cette personne.')
              }
            } finally {
              await loadBlocks()
              setUnblockingId(null)
            }
          },
        },
      ],
    )
  }

  const friendActions = (friend: Friend) => [
    {
      label: 'Renommer',
      onPress: () => {
        setRenameError(null)
        setRenaming(friend)
      },
    },
    {
      label: 'Signaler',
      onPress: () =>
        setReporting({ id: friend.id, name: displayName(friend) }),
    },
    {
      label: 'Bloquer',
      destructive: true,
      onPress: () =>
        confirmBlock({ id: friend.id, name: displayName(friend) }),
    },
    {
      label: 'Retirer',
      destructive: true,
      onPress: () => confirmRemove(friend),
    },
  ]

  const saveAlias = async (
    action: (friend: Friend) => Promise<unknown>,
  ) => {
    if (!renaming) {
      return
    }

    setRenameSaving(true)
    setRenameError(null)

    try {
      await action(renaming)
      setRenaming(null)
      await load()
    } catch (err) {
      console.error('Alias error:', err)
      setRenameError("Impossible d'enregistrer.")
    } finally {
      setRenameSaving(false)
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        Seuls tes amis voient tes pas, et tu ne vois que les leurs.
      </Text>

      <Pressable
        style={[styles.primaryButton, inviting && styles.disabled]}
        onPress={handleInvite}
        disabled={inviting}
      >
        <Text style={styles.primaryButtonText}>
          {inviting ? 'Création du lien...' : 'Inviter des amis'}
        </Text>
      </Pressable>

      {codeInputVisible ? (
        <View style={styles.codeRow}>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={setCode}
            placeholder="K7F3-M9QX"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={16}
            returnKeyType="go"
            onSubmitEditing={handleCode}
          />
          <Pressable
            style={[styles.codeButton, !code.trim() && styles.disabled]}
            onPress={handleCode}
            disabled={!code.trim()}
          >
            <Text style={styles.primaryButtonText}>OK</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.secondaryButton}
          onPress={() => setCodeInputVisible(true)}
        >
          <Text style={styles.secondaryButtonText}>J'ai un code</Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionTitle}>
        {friends.length > 0 ? `Mes amis (${friends.length})` : 'Mes amis'}
      </Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : friends.length === 0 ? (
        <Text style={styles.empty}>
          Pas encore d'amis. Partage un lien d'invitation : chaque personne
          qui l'ouvre et accepte rejoint ta liste d'amis.
        </Text>
      ) : (
        <View style={styles.list}>
          {friends.map((friend) => (
            <Pressable
              key={friend.id}
              style={styles.row}
              onPress={() => setActionsFor(friend)}
            >
              <UserBadge userId={friend.id} name={displayName(friend)} />
              <View style={styles.names}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName(friend)}
                </Text>
                {friend.alias && friend.alias !== friend.name && (
                  <Text style={styles.realName} numberOfLines={1}>
                    {friend.name}
                  </Text>
                )}
              </View>
              <Text style={styles.chevron}>⋯</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!loading && invitations.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            {`Liens d'invitation actifs (${invitations.length})`}
          </Text>
          <Text style={styles.hint}>
            Par sécurité, l'appli ne garde pas les liens : pour inviter
            quelqu'un d'autre, crée un nouveau lien.
          </Text>

          <View style={styles.list}>
            {invitations.map((invitation) => (
              <View key={invitation.id} style={styles.row}>
                <View style={styles.names}>
                  <Text style={styles.name} numberOfLines={1}>
                    {`Créé le ${formatDate(invitation.createdAt)}`}
                  </Text>
                  <Text style={styles.realName} numberOfLines={1}>
                    {`Expire le ${formatDate(invitation.expiresAt)} · ${formatUseCount(invitation.useCount)}`}
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.revokeButton,
                    revokingId === invitation.id && styles.disabled,
                  ]}
                  onPress={() => confirmRevoke(invitation)}
                  disabled={revokingId === invitation.id}
                  hitSlop={8}
                >
                  <Text style={styles.revokeButtonText}>Désactiver</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}

      {!loading && blocked.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            {`Personnes bloquées (${blocked.length})`}
          </Text>
          <Text style={styles.hint}>
            Elles ne peuvent plus devenir tes amies et ne savent pas qu'elles
            sont bloquées.
          </Text>

          <View style={styles.list}>
            {blocked.map((user) => (
              <View key={user.userId} style={styles.row}>
                <View style={styles.names}>
                  <Text style={styles.name} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text style={styles.realName} numberOfLines={1}>
                    {`Bloqué le ${formatDate(user.since)}`}
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.unblockButton,
                    unblockingId === user.userId && styles.disabled,
                  ]}
                  onPress={() => confirmUnblock(user)}
                  disabled={unblockingId === user.userId}
                  hitSlop={8}
                >
                  <Text style={styles.unblockButtonText}>Débloquer</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}

      <ActionSheet
        title={actionsFor ? displayName(actionsFor) : null}
        actions={actionsFor ? friendActions(actionsFor) : []}
        onClose={() => setActionsFor(null)}
      />

      <ReportUserModal
        target={reporting}
        onClose={() => setReporting(null)}
        onBlock={blockReported}
      />

      <RenameFriendModal
        friend={renaming}
        saving={renameSaving}
        error={renameError}
        onSave={(alias) => saveAlias((f) => setFriendAlias(f.id, alias))}
        onReset={() => saveAlias((f) => removeFriendAlias(f.id))}
        onClose={() => setRenaming(null)}
      />
    </ScrollView>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

function formatUseCount(count: number) {
  if (count === 0) {
    return 'pas encore utilisé'
  }

  return count === 1
    ? 'accepté par 1 personne'
    : `accepté par ${count} personnes`
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  intro: {
    fontSize: 15,
    lineHeight: 21,
    color: '#6B7280',
    marginBottom: 16,
  },

  primaryButton: {
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#208AEF',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  secondaryButton: {
    marginTop: 10,
    minHeight: 46,
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

  codeRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },

  codeInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 17,
    letterSpacing: 2,
    color: '#111827',
  },

  codeButton: {
    width: 64,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#208AEF',
  },

  error: {
    marginTop: 12,
    fontSize: 14,
    color: '#DC2626',
  },

  sectionTitle: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  loader: {
    marginTop: 20,
  },

  empty: {
    fontSize: 15,
    lineHeight: 21,
    color: '#6B7280',
  },

  list: {
    gap: 8,
  },

  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
  },

  names: {
    flex: 1,
  },

  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  realName: {
    fontSize: 13,
    color: '#9CA3AF',
  },

  hint: {
    marginTop: -4,
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
    color: '#9CA3AF',
  },

  revokeButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },

  unblockButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },

  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#208AEF',
  },

  revokeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },

  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
  },

  disabled: {
    opacity: 0.5,
  },
})
