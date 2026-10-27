// Friends and sharing, straight against Supabase. Row Level Security in
// supabase/migrations/0002_social.sql is what stops anyone reading or sending
// what they shouldn't; nothing here needs to be trusted.

import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

export async function me() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Sign in first.')
  return id
}

// Supabase returns { data, error }; turn the error into a throw so callers can
// use one try/catch and show the message.
export function ok({ data, error }) {
  if (error) throw new Error(error.code === '23505' ? 'That tag is taken.' : error.message)
  return data
}

export const cleanTag = tag => (tag || '').trim().replace(/^@/, '').toLowerCase()

// ── Profile ─────────────────────────────────────────────────────────────────
export async function myProfile() {
  const id = await me()
  return ok(await supabase.from('profiles').select('tag, name, avatar_url').eq('user_id', id).maybeSingle())
}

export const validTag = t => /^[a-z0-9_]{3,20}$/.test(t)

/** 'free', 'taken' or 'mine', for the live hint under the tag field. The
 *  unique index is the real guarantee; this just says so before you press Save. */
export async function tagStatus(tag) {
  const t = cleanTag(tag)
  const row = ok(await supabase.from('profiles').select('user_id').eq('tag', t).maybeSingle())
  if (!row) return 'free'
  return row.user_id === (await me()) ? 'mine' : 'taken'
}

export async function setTag(tag, name = '') {
  const t = cleanTag(tag)
  if (!validTag(t)) throw new Error('Tags are 3–20 letters, numbers or _.')
  ok(await supabase.from('profiles').upsert({ user_id: await me(), tag: t, name }))
  changed()
  return t
}

/**
 * Square-crop and shrink to 256px WebP in the browser, then upload. A phone
 * photo is several MB; the stored picture is a few KB and loads instantly.
 */
export async function uploadAvatar(file) {
  const id = await me()
  if (!(await myProfile())) throw new Error('Pick a tag first.')
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  canvas.getContext('2d').drawImage(
    bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256,
  )
  const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.85))
  const path = `${id}/avatar.webp`
  ok(await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/webp' }))
  // Same path every time, so a version query makes browsers fetch the new one.
  const url = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  ok(await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', id))
  changed()
  return url
}

// ── My profile, shared by every screen that shows it ────────────────────────
// One fetch, one copy; setTag/uploadAvatar refresh it everywhere at once.
let mine = { promise: null, value: undefined }
const listeners = new Set()
function changed() {
  mine = { promise: null, value: undefined }
  listeners.forEach(fn => fn())
}

/** undefined while loading, null with no tag yet, else { tag, name, avatar_url }. */
export function useMyProfile() {
  const [profile, setProfile] = useState(mine.value)
  useEffect(() => {
    let live = true
    const load = () => {
      mine.promise ??= myProfile().then(p => (mine.value = p), () => null)
      mine.promise.then(p => live && setProfile(p))
    }
    load()
    listeners.add(load)
    return () => { live = false; listeners.delete(load) }
  }, [])
  return profile
}

// ── Friends ─────────────────────────────────────────────────────────────────
/** Every friendship involving me, with the other person's profile attached. */
export async function listFriends() {
  const id = await me()
  const rows = ok(await supabase.from('friendships').select('id, requester, addressee, status'))
  const others = rows.map(r => (r.requester === id ? r.addressee : r.requester))
  const profiles = others.length
    ? ok(await supabase.from('profiles').select('user_id, tag, name, avatar_url').in('user_id', others))
    : []
  return rows.map((r, i) => ({
    id: r.id,
    status: r.status,
    incoming: r.addressee === id,
    friend: profiles.find(p => p.user_id === others[i]) || { user_id: others[i], tag: '?', name: '' },
  }))
}

export async function sendRequest(tag) {
  const t = cleanTag(tag)
  const other = ok(await supabase.from('profiles').select('user_id').eq('tag', t).maybeSingle())
  if (!other) throw new Error(`No one is called @${t}.`)
  const id = await me()
  if (other.user_id === id) throw new Error("That's you.")
  const res = await supabase.from('friendships').insert({ requester: id, addressee: other.user_id })
  if (res.error?.code === '23505') throw new Error(`You and @${t} are already connected.`)
  ok(res)
}

export async function accept(friendshipId) {
  ok(await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId))
}

export async function removeFriend(friendshipId) {
  ok(await supabase.from('friendships').delete().eq('id', friendshipId))
}

// ── Sharing ─────────────────────────────────────────────────────────────────
export async function share(recipient, kind, payload) {
  ok(await supabase.from('shares').insert({ sender: await me(), recipient, kind, payload }))
}

/** Items waiting for me, newest first. */
export async function inbox() {
  const id = await me()
  return ok(
    await supabase
      .from('shares')
      .select('id, sender, kind, payload, created_at')
      .eq('recipient', id)
      .order('created_at', { ascending: false }),
  )
}

export async function dismiss(shareId) {
  ok(await supabase.from('shares').delete().eq('id', shareId))
}

/** Calls onChange whenever a friendship or share touching me changes. */
export function subscribe(onChange) {
  // RLS filters realtime too, so only rows I can read arrive here.
  const channel = supabase
    .channel(`social:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shares' }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
