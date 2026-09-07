import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { ask } from '../ai/groq.js'

const SUGGESTIONS = [
  'Add a task to buy milk tomorrow',
  'Set a 20 minute timer for laundry',
  'Gym every Monday 7 to 9 am',
  "What's on my schedule this week?",
]

export default function Assistant() {
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

  if (!state.apiKey) return <ApiKeyForm dispatch={dispatch} />

  async function send(text) {
    const message = (text ?? input).trim()
    if (!message || busy) return

    setInput('')
    setError('')
    setBusy(true)
    setChat(c => [...c, { role: 'user', content: message }])

    try {
      const { text: answer, actions } = await ask({
        apiKey: state.apiKey,
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

  return (
    <div className="chat">
      {chat.length === 0 && (
        <div className="chat-empty">
          <img src="/mascot.png" alt="" className="mascot mascot-lg" />
          <p className="placeholder">Ask me to change anything in the app.</p>
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
          </div>
        ))}

        {busy && <div className="bubble assistant thinking"><span /><span /><span /></div>}
        <div ref={endRef} />
      </div>

      {error && <p className="error">{error}</p>}

      <form className="row" onSubmit={e => { e.preventDefault(); send() }}>
        <input
          className="grow"
          placeholder="Ask or tell me to do something…"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={busy}
        />
        <button className="primary" disabled={busy || !input.trim()}>Send</button>
      </form>

      <button className="ghost always" onClick={() => dispatch({ type: 'set-api-key', value: '' })}>
        Change API key
      </button>
    </div>
  )
}

function ApiKeyForm({ dispatch }) {
  const [value, setValue] = useState('')

  return (
    <form
      className="keyform"
      onSubmit={e => { e.preventDefault(); if (value.trim()) dispatch({ type: 'set-api-key', value: value.trim() }) }}
    >
      <h3>Connect the assistant</h3>
      <p className="placeholder" style={{ padding: 0, textAlign: 'left' }}>
        Paste a free Groq API key from console.groq.com. It's stored only in this
        browser — anyone with access to this device can read it, so don't use a
        key that has billing attached to it.
      </p>
      <div className="row">
        <input
          className="grow"
          type="password"
          placeholder="gsk_…"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        <button className="primary">Save</button>
      </div>
    </form>
  )
}
