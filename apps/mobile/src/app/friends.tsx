import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { useFormatters, type Formatters } from '@/i18n'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

/**
 * Friends screen (ADR 0002): invite friends with a link, accept a code,
 * rename (alias) or remove a friend, list and revoke my active
 * invitation links. Report, block and unblock (ADR 0004). Opened from
 * the leaderboard.
 */
export default function FriendsScreen() {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t } = useTranslation()
  const formatters = useFormatters()

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
      setError(t('friends.loadError'))
    } finally {
      setLoading(false)
    }
  }, [loadInvitations, loadBlocks, t])

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
        message: t('friends.invite.message', { url: invitation.url }),
      })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'too_many_invitations') {
        setError(t('friends.invite.tooMany'))
      } else {
        console.error('Invitation error:', err)
        setError(t('friends.invite.error'))
      }
    } finally {
      setInviting(false)
      // The new link appears in the list, even if sharing was cancelled.
      loadInvitations()
    }
  }

  const confirmRevoke = (invitation: ActiveInvitation) => {
    Alert.alert(
      t('friends.revoke.title'),
      t('friends.revoke.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('friends.revoke.confirm'),
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
                setError(t('friends.revoke.error'))
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
      t('friends.remove.title', { name: displayName(friend) }),
      t('friends.remove.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('friends.remove.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(friend.id)
              await load()
            } catch (err) {
              console.error('Remove friend error:', err)
              setError(t('friends.remove.error'))
            }
          },
        },
      ],
    )
  }

  const confirmBlock = (target: { id: string; name: string }) => {
    Alert.alert(
      t('friends.block.title', { name: target.name }),
      t('friends.block.message', { name: target.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('friends.block.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(target.id)
              await load()
            } catch (err) {
              console.error('Block error:', err)
              setError(t('friends.block.error'))
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
      t('friends.unblock.title', { name: user.name }),
      t('friends.unblock.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('friends.unblock.confirm'),
          onPress: async () => {
            setUnblockingId(user.userId)

            try {
              await unblockUser(user.userId)
            } catch (err) {
              // Already unblocked (double tap): the reload shows it.
              if (!(err instanceof ApiError && err.status === 404)) {
                console.error('Unblock error:', err)
                setError(t('friends.unblock.error'))
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
      label: t('friends.actions.rename'),
      onPress: () => {
        setRenameError(null)
        setRenaming(friend)
      },
    },
    {
      label: t('friends.actions.report'),
      onPress: () =>
        setReporting({ id: friend.id, name: displayName(friend) }),
    },
    {
      label: t('friends.block.confirm'),
      destructive: true,
      onPress: () =>
        confirmBlock({ id: friend.id, name: displayName(friend) }),
    },
    {
      label: t('friends.remove.confirm'),
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
      setRenameError(t('friends.rename.error'))
    } finally {
      setRenameSaving(false)
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.intro}>{t('friends.intro')}</Text>

      <Pressable
        style={[styles.primaryButton, inviting && styles.disabled]}
        onPress={handleInvite}
        disabled={inviting}
      >
        <Text style={styles.primaryButtonText}>
          {inviting ? t('friends.invite.creating') : t('friends.invite.button')}
        </Text>
      </Pressable>

      {codeInputVisible ? (
        <View style={styles.codeRow}>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={setCode}
            placeholder="K7F3-M9QX"
            placeholderTextColor={colors.textMuted}
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
            <Text style={styles.primaryButtonText}>{t('common.ok')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.secondaryButton}
          onPress={() => setCodeInputVisible(true)}
        >
          <Text style={styles.secondaryButtonText}>
            {t('friends.haveCode')}
          </Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionTitle}>
        {friends.length > 0
          ? t('friends.listCount', { count: friends.length })
          : t('friends.list')}
      </Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : friends.length === 0 ? (
        <Text style={styles.empty}>{t('friends.empty')}</Text>
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
            {t('friends.invitations.title', { count: invitations.length })}
          </Text>
          <Text style={styles.hint}>{t('friends.invitations.hint')}</Text>

          <View style={styles.list}>
            {invitations.map((invitation) => (
              <View key={invitation.id} style={styles.row}>
                <View style={styles.names}>
                  <Text style={styles.name} numberOfLines={1}>
                    {t('friends.invitations.created', {
                      date: formatShortDate(invitation.createdAt, formatters),
                    })}
                  </Text>
                  <Text style={styles.realName} numberOfLines={1}>
                    {t('friends.invitations.expires', {
                      date: formatShortDate(invitation.expiresAt, formatters),
                    })}
                    {' · '}
                    {invitation.useCount === 0
                      ? t('friends.invitations.unused')
                      : t('friends.invitations.accepted', {
                          count: invitation.useCount,
                        })}
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
                  <Text style={styles.revokeButtonText}>
                    {t('friends.revoke.confirm')}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}

      {!loading && blocked.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            {t('friends.blocked.title', { count: blocked.length })}
          </Text>
          <Text style={styles.hint}>{t('friends.blocked.hint')}</Text>

          <View style={styles.list}>
            {blocked.map((user) => (
              <View key={user.userId} style={styles.row}>
                <View style={styles.names}>
                  <Text style={styles.name} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text style={styles.realName} numberOfLines={1}>
                    {t('friends.blocked.since', {
                      date: formatShortDate(user.since, formatters),
                    })}
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
                  <Text style={styles.unblockButtonText}>
                    {t('friends.unblock.confirm')}
                  </Text>
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

function formatShortDate(value: string, f: Formatters) {
  return f.formatDate(new Date(value), {
    day: 'numeric',
    month: 'short',
  })
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },

    container: {
      padding: 20,
      paddingBottom: 40,
    },

    intro: {
      fontSize: 15,
      lineHeight: 21,
      color: c.textSecondary,
      marginBottom: 16,
    },

    primaryButton: {
      minHeight: 50,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },

    primaryButtonText: {
      color: c.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },

    secondaryButton: {
      marginTop: 10,
      minHeight: 46,
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

    codeRow: {
      marginTop: 10,
      flexDirection: 'row',
      gap: 8,
    },

    codeInput: {
      flex: 1,
      height: 46,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 17,
      letterSpacing: 2,
      color: c.text,
    },

    codeButton: {
      width: 64,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },

    error: {
      marginTop: 12,
      fontSize: 14,
      color: c.danger,
    },

    sectionTitle: {
      marginTop: 28,
      marginBottom: 10,
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
    },

    loader: {
      marginTop: 20,
    },

    empty: {
      fontSize: 15,
      lineHeight: 21,
      color: c.textSecondary,
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
      backgroundColor: c.surface,
    },

    names: {
      flex: 1,
    },

    name: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },

    realName: {
      fontSize: 13,
      color: c.textMuted,
    },

    hint: {
      marginTop: -4,
      marginBottom: 10,
      fontSize: 13,
      lineHeight: 18,
      color: c.textMuted,
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
      color: c.primary,
    },

    revokeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.danger,
    },

    chevron: {
      fontSize: 20,
      color: c.textMuted,
    },

    disabled: {
      opacity: 0.5,
    },
  })
