import { apiFetch } from './client'

/** API of ADR 0002: invitation links, friends and aliases. */

export type Friend = {
  id: string
  /** Name chosen by the friend. */
  name: string
  /** Name I gave this friend, if any. Only I can see it. */
  alias: string | null
  since: string
}

export type Invitation = {
  id: string
  /** Formatted code, e.g. "K7F3-M9QX". Returned only at creation. */
  code: string
  url: string
  expiresAt: string
}

export type InvitationPreview = {
  inviter: { id: string; name: string }
  expiresAt: string
  isOwnInvitation: boolean
  alreadyFriends: boolean
}

export type AcceptedInvitation = {
  friend: { id: string; name: string }
  alreadyFriends: boolean
}

/** Name to show for a friend: my alias, otherwise their own name. */
export function displayName(friend: { name: string; alias?: string | null }) {
  return friend.alias ?? friend.name
}

export function listFriends() {
  return apiFetch<Friend[]>('/api/friends')
}

export function createInvitation() {
  return apiFetch<Invitation>('/api/invitations', { method: 'POST' })
}

function codePath(code: string) {
  return `/api/invitations/${encodeURIComponent(code.trim())}`
}

export function previewInvitation(code: string) {
  return apiFetch<InvitationPreview>(codePath(code))
}

export function acceptInvitation(code: string) {
  return apiFetch<AcceptedInvitation>(`${codePath(code)}/accept`, {
    method: 'POST',
  })
}

export function removeFriend(friendId: string) {
  return apiFetch(`/api/friends/${friendId}`, { method: 'DELETE' })
}

export function setFriendAlias(friendId: string, alias: string) {
  return apiFetch<{ id: string; alias: string }>(
    `/api/friends/${friendId}/alias`,
    { method: 'PUT', body: { alias } },
  )
}

export function removeFriendAlias(friendId: string) {
  return apiFetch(`/api/friends/${friendId}/alias`, { method: 'DELETE' })
}
