// Chats, straight against Supabase like social.js. Row Level Security in
// supabase/migrations/0005_chat.sql decides who reads and posts where; chats
// are only created through the start_chat / create_group functions, which
// check friendship first.

import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { me, ok } from './social.js'

export { me }

const PAGE = 50

// PostgREST says PGRST202 when a function doesn't exist, i.e. 0005_chat.sql
// hasn't been run on this project yet.
function okChat(res) {
  if (res.error?.code === 'PGRST202' || res.error?.code === '42P01') {
    throw new Error("Chats aren't set up yet. Run supabase/migrations/0005_chat.sql in Supabase.")
  }
  return ok(res)
}

/** Every chat I'm in, latest activity first, with members and unread count. */
export async function listChats() {
  return okChat(await supabase.rpc('my_chats')) ?? []
}

/** The one-to-one chat with a friend (created if new). Returns its id. */
export async function startChat(friendId) {
  return okChat(await supabase.rpc('start_chat', { friend: friendId }))
}

export async function createGroup(title, memberIds) {
  return okChat(await supabase.rpc('create_group', { title, members: memberIds }))
}

/** A page of messages, oldest first. `before` (an ISO time) pages backwards. */
export async function loadMessages(conversationId, before) {
  let q = supabase
    .from('messages')
    .select('id, conversation_id, sender, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(PAGE)
  if (before) q = q.lt('created_at', before)
  const rows = okChat(await q)
  return { messages: rows.reverse(), more: rows.length === PAGE }
}

export async function send(conversationId, body) {
  return okChat(
    await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, body })
      .select('id, conversation_id, sender, body, created_at')
      .single(),
  )
}

export async function markRead(conversationId) {
  const id = await me()
  okChat(
    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', id),
  )
}

export async function leave(conversationId) {
  const id = await me()
  okChat(
    await supabase.from('conversation_members').delete().eq('conversation_id', conversationId).eq('user_id', id),
  )
}

/**
 * Calls onMessage(row) for each new message I can see, and onChange() when
 * chats I'm in change (joined, left, someone marked read). RLS filters what
 * realtime delivers, so no per-chat filter is needed.
 */
export function subscribe({ onMessage, onChange }) {
  const channel = supabase
    .channel(`chat:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => {
      onMessage?.(p.new)
      onChange?.()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => onChange?.())
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

/** Total unread messages across my chats, kept live. 0 while unknown. */
export function useUnread() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let alive = true
    const refresh = () =>
      listChats()
        .then(chats => { if (alive) setCount(chats.reduce((n, c) => n + (c.unread || 0), 0)) })
        .catch(() => {}) // not set up, or signed out: just no badge
    refresh()
    const stop = subscribe({ onChange: refresh })
    window.addEventListener('focus', refresh)
    return () => {
      alive = false
      stop()
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return count
}
