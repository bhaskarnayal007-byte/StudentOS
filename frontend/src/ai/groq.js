import { TOOL_DEFS, runTool, systemPrompt } from './tools.js'
import { API_URL, accessToken } from '../lib/supabase.js'

// One HTTP request — but to our own backend, not to Groq. The API key used to
// live in localStorage, where any devtools user could read it; now it never
// leaves the server. The model name lives there too (AI_MODEL), so switching
// providers doesn't touch the frontend at all.
async function callModel(messages) {
  // Read the token per request: supabase-js rotates it in the background, so
  // a copy taken at mount would 401 within the hour.
  const token = await accessToken()
  if (!token) throw new Error('Signed out — sign in again to use the assistant.')

  let res
  try {
    res = await fetch(`${API_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages,
        tools: TOOL_DEFS,
        tool_choice: 'auto', // the model decides whether to use a tool
        temperature: 0.3,    // low: we want obedient, not creative
      }),
    })
  } catch {
    // fetch only rejects when the request never got a reply — server down,
    // wrong URL, no network. Every HTTP status, including 500, resolves. The
    // raw message is "Failed to fetch", which tells a user nothing.
    throw new Error(`Can't reach the assistant server at ${API_URL}. Is it running?`)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // Surface the real reason (rate limit, bad request, server down) rather
    // than a generic "something went wrong".
    throw new Error(body.error ?? `Assistant failed (${res.status})`)
  }

  return res.json()
}

// ─────────────────────────────────────────────────────────────────────────────
// THE AGENT LOOP. This is the part people think is complicated. It is 25 lines.
//
//   send everything so far  →  model replies
//   ├─ plain text?      → done, show it
//   └─ tool_calls?      → run them, append the results, send again
//
// The loop exists because the model may need several rounds: check the state,
// then act, then report. maxRounds stops a confused model looping forever.
// ─────────────────────────────────────────────────────────────────────────────
// `getState` is a FUNCTION, not the state object. Each tool call may have
// changed the data, and the next one must see the change — "add a task, then
// complete it" only works if the second call reads fresh state.
// maxRounds was 4, which a request like "add my chem assignment and block two
// hours to study for it" can exhaust before it finishes — each tool call plus
// its confirmation is a round. 8 leaves room for a multi-step request and
// still stops a confused model looping forever.
export async function ask({ history, userText, getState, dispatch, maxRounds = 8 }) {
  const messages = [
    { role: 'system', content: systemPrompt(getState()) },
    ...history,
    { role: 'user', content: userText },
  ]

  // Names of tools we actually ran, so the UI can show what happened.
  const actions = []

  for (let round = 0; round < maxRounds; round++) {
    const data = await callModel(messages)
    const reply = data.choices[0].message

    // The assistant's turn must go into the transcript before the tool results,
    // or the next request is malformed — tool results have to answer something.
    messages.push(reply)

    if (!reply.tool_calls?.length) {
      return { text: reply.content ?? '', actions }
    }

    for (const call of reply.tool_calls) {
      let result
      try {
        // Arguments arrive as a JSON *string* the model wrote, so it can be
        // malformed. Parsing must be guarded.
        const args = JSON.parse(call.function.arguments || '{}')
        result = runTool(call.function.name, args, { state: getState(), dispatch })
        actions.push(call.function.name)
      } catch (err) {
        result = `Error: ${err.message}`
      }

      // Feed the outcome back so the model can confirm or correct itself.
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
    }
  }

  return { text: "I got stuck repeating myself — could you rephrase that?", actions }
}
