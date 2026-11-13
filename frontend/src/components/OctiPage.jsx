// The /octi page: a chat with Octi, who changes the app through the same actions the buttons use. OctiDock shows it too.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ask } from '../ai/agentLoop.js'
import { canListen, listen } from '../lib/speech.js'
import { supabase } from '../lib/supabase.js'

const SUGGESTIONS = [
  'Add a task to buy milk tomorrow',
  'Set a 20 minute timer for laundry',
  'Gym every Monday 7 to 9 am',
  "What's on my schedule this week?",
]

// Speech to text: the browser's on the website, Android's in the app (lib/speech.js).

// What each failure means to the person holding the phone.
const MIC_ERRORS = {
  'not-allowed': 'The microphone is blocked. Allow it for Stratus to talk to Octi.',
  'service-not-allowed': "Voice isn't available on this device. Type instead.",
  'audio-capture': 'No microphone found.',
  network: 'Voice needs an internet connection. Type instead for now.',
}

export default function OctiPage() {
  const { state, dispatch } = useStore()

  // The conversation is deliberately NOT in the store — it's a session thing,
  // and persisting it would grow localStorage forever for little benefit.
  const [chat, setChat] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // A ref always holds the latest value. `state` captured inside an async
  // function would be frozen at the moment the request started — stale by the
  // time the tools run. This is the standard fix.
  const stateRef = useRef(state)
  stateRef.current = state

  const endRef = useRef(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat, busy])

  const [listening, setListening] = useState(false)
  const recognition = useRef(null)
  // Closing the panel or leaving the page must not leave the mic open.
  useEffect(() => () => recognition.current?.abort(), [])

  // Speech fills the box rather than sending itself, so a misheard word can be
  // fixed before Octi acts on it.
  function toggleMic() {
    if (listening) {
      recognition.current?.stop()
      return
    }
    // Speaking adds to whatever was already typed.
    const typed = input.trim() ? `${input.trim()} ` : ''
    setError('')
    setListening(true)
    recognition.current = listen({
      // Indian English: the default en-US hears local names and accents worse.
      lang: 'en-IN',
      onText: text => setInput(typed + text),
      onError: code => setError(MIC_ERRORS[code] ?? `Couldn't hear that (${code}). Try again or type it.`),
      onEnd: () => setListening(false),
    })
  }

  async function send(text) {
    const message = (text ?? input).trim()
    if (!message || busy) return

    // abort, not stop: a late result must not refill the box just cleared.
    recognition.current?.abort()
    setInput('')
    setError('')
    setBusy(true)
    setChat(c => [...c, { role: 'user', content: message }])

    try {
      const { text: answer, actions } = await ask({
        // Only the plain user/assistant turns go back as history — tool
        // plumbing from previous requests would just confuse the model.
        history: chat.map(m => ({ role: m.role, content: m.content })),
        userText: message,
        getState: () => stateRef.current,
        dispatch,
      })
      setChat(c => [...c, { role: 'assistant', content: answer, actions }])
    } catch (err) {
      setError(err.message)
    } finally {
      // `finally` so a crash can never leave the input disabled forever.
      setBusy(false)
    }
  }

  // Play requires a way to flag offensive AI output without leaving the app.
  // The reply and the message before it go to content_reports (migration 0009).
  async function report(i) {
    const { error } = await supabase.from('content_reports').insert({
      kind: 'octi',
      content: chat[i].content.slice(0, 8000),
      context: chat[i - 1]?.content.slice(0, 4000) ?? null,
    })
    if (error) return setError("Couldn't send the report. Check your connection and try again.")
    setChat(c => c.map((m, j) => (j === i ? { ...m, reported: true } : m)))
  }

  return (
    <div className="chat">
      {chat.length === 0 && (
        <div className="chat-empty">
          <img src="/mascot.png" alt="" className="mascot mascot-lg" />
          <p className="placeholder">Ask me to change anything in the app.</p>
          <p className="ai-note">
            Octi is an AI and can get things wrong. What you send, and the data needed to answer it,
            goes to our AI provider. <Link to="/privacy">Privacy</Link>
          </p>
          <div className="suggestions">
            {SUGGESTIONS.map(s => (
              <button key={s} className="suggestion" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      <div className="messages">
        {chat.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
            {m.actions?.length > 0 && (
              <div className="actions">
                {/* Showing which tools ran makes the AI auditable instead of
                    mysterious — you can see exactly what it touched. */}
                {m.actions.map((a, j) => <span key={j} className="chip">{a}</span>)}
              </div>
            )}
            {m.role === 'assistant' && (
              <button className="report" onClick={() => report(i)} disabled={m.reported}>
                {m.reported ? 'Reported, thanks' : 'Report'}
              </button>
            )}
          </div>
        ))}

        {busy && <div className="bubble assistant thinking"><span /><span /><span /></div>}
        <div ref={endRef} />
      </div>

      {error && <p className="error">{error}</p>}

      <form className="row" onSubmit={e => { e.preventDefault(); send() }}>
        <input
          className="grow"
          placeholder={listening ? 'Listening…' : 'Ask or tell me to do something…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={busy}
        />
        {canListen && (
          <button
            type="button"
            className={listening ? 'mic listening' : 'mic'}
            onClick={toggleMic}
            disabled={busy}
            aria-label={listening ? 'Stop listening' : 'Speak to Octi'}
            aria-pressed={listening}
            title={listening ? 'Stop listening' : 'Speak'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
            </svg>
          </button>
        )}
        <button className="primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  )
}
