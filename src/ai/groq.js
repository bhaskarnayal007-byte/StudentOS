import { TOOL_DEFS, runTool, systemPrompt } from './tools.js'

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

// Swap this for any model your Groq account lists at /openai/v1/models.
// (llama-3.3-70b-versatile was retired by Groq; this one is the strongest
// tool-calling model currently available on the free tier.)
const MODEL = 'openai/gpt-oss-120b'

// One HTTP request to Groq. That's the entire "SDK" — no package needed.
// Groq speaks the OpenAI format, so this same function works against OpenAI
// or anything else that copies it: change ENDPOINT and MODEL.
async function callGroq(apiKey, messages) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOL_DEFS,
      tool_choice: 'auto', // the model decides whether to use a tool
      temperature: 0.3,    // low: we want obedient, not creative
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    // Surface the real reason (bad key, rate limit, bad request) instead of
    // a generic "something went wrong".
    throw new Error(`Groq ${res.status}: ${body.slice(0, 300)}`)
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
export async function ask({ apiKey, history, userText, getState, dispatch, maxRounds = 4 }) {
  const messages = [
    { role: 'system', content: systemPrompt(getState()) },
    ...history,
    { role: 'user', content: userText },
  ]

  // Names of tools we actually ran, so the UI can show what happened.
  const actions = []

  for (let round = 0; round < maxRounds; round++) {
    const data = await callGroq(apiKey, messages)
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
