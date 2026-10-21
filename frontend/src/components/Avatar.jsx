import { useRef, useState } from 'react'
import { uploadAvatar } from '../lib/social.js'

/** A round profile picture, or the tag's first letter when there isn't one. */
export default function Avatar({ profile, size = 32 }) {
  const [broken, setBroken] = useState(false)
  const style = { width: size, height: size, fontSize: size * 0.42 }
  if (profile?.avatar_url && !broken) {
    return <img className="avatar" src={profile.avatar_url} alt="" style={style} onError={() => setBroken(true)} />
  }
  return (
    <span className="avatar avatar-letter" style={style} aria-hidden="true">
      {(profile?.tag || profile?.name || '?')[0].toUpperCase()}
    </span>
  )
}

/** Your own picture, as a button that picks a new one. */
export function AvatarPicker({ profile, size = 72 }) {
  const input = useRef(null)
  const [status, setStatus] = useState('')

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStatus('Uploading…')
    try {
      await uploadAvatar(file)
      setStatus('')
    } catch (err) {
      setStatus(err.message)
    }
  }

  return (
    <span className="avatar-picker">
      <button type="button" className="avatar-btn" onClick={() => input.current.click()} aria-label="Change profile picture" title="Change profile picture">
        <Avatar profile={profile} size={size} />
        <span className="avatar-edit" aria-hidden="true">✎</span>
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
      {status && <span className="settings-status" role="status">{status}</span>}
    </span>
  )
}
