// Speech to text for Octi's mic button, the same shape in both places it runs:
// - the website: the browser's own recognizer (Chrome sends the audio to
//   Google; Firefox has none, so there the button isn't shown);
// - the Android app: Android's recognizer through @capgo/capacitor-speech-recognition,
//   because the app's WebView has no working browser one. It asks for the
//   microphone permission the first time.
// ponytail: no server-side Whisper; add it through the Worker when accuracy
// for Hinglish or browsers without speech start to matter.

import { isNative } from './supabase.js'

const BrowserRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

/** Whether this device can listen at all. */
export const canListen = isNative || Boolean(BrowserRecognition)

/**
 * Start listening. `onText(transcript)` gets the words heard so far each time
 * they change, `onError(code)` a failure ('not-allowed', 'audio-capture',
 * 'network', …), `onEnd()` once it has stopped for any reason.
 * Returns { stop, abort }: stop keeps what was heard, abort drops the rest.
 */
export function listen({ lang, onText, onError, onEnd }) {
  return isNative ? listenNative({ lang, onText, onError, onEnd }) : listenBrowser({ lang, onText, onError, onEnd })
}

function listenBrowser({ lang, onText, onError, onEnd }) {
  const rec = new BrowserRecognition()
  rec.lang = lang
  rec.interimResults = true
  rec.onresult = e => onText([...e.results].map(r => r[0].transcript).join(''))
  rec.onerror = e => {
    // Silence and our own abort() aren't failures.
    if (e.error !== 'no-speech' && e.error !== 'aborted') onError(e.error)
  }
  rec.onend = onEnd
  rec.start()
  return { stop: () => rec.stop(), abort: () => rec.abort() }
}

function listenNative({ lang, onText, onError, onEnd }) {
  let aborted = false
  let ended = false
  let plugin
  const handles = []
  const end = () => {
    if (ended) return
    ended = true
    handles.forEach(h => h.remove())
    onEnd()
  }

  ;(async () => {
    try {
      const { SpeechRecognition } = await import('@capgo/capacitor-speech-recognition')
      plugin = SpeechRecognition
      // Android shows its own "Allow Stratus to record audio?" the first time.
      let { speechRecognition } = await plugin.checkPermissions()
      if (speechRecognition !== 'granted') ({ speechRecognition } = await plugin.requestPermissions())
      if (speechRecognition !== 'granted') return onError('not-allowed'), end()
      if (!(await plugin.available()).available) return onError('service-not-allowed'), end()
      if (aborted) return end()

      handles.push(
        await plugin.addListener('partialResults', e => {
          const text = e.matches?.[0] ?? e.accumulatedText
          if (text && !aborted) onText(text)
        }),
        await plugin.addListener('listeningState', e => e.state === 'stopped' && end()),
        await plugin.addListener('error', e => {
          // Android reports silence as an error ("no match"); that's not one.
          if (!/no.?match|speech.?timeout/i.test(`${e.code} ${e.message}`)) onError(/network/i.test(e.message) ? 'network' : e.code)
          end()
        }),
      )
      await plugin.start({ language: lang, partialResults: true, popup: false })
    } catch (err) {
      onError(/permission/i.test(err?.message) ? 'not-allowed' : 'audio-capture')
      end()
    }
  })()

  return {
    stop: () => plugin?.stop().catch(() => {}),
    abort: () => {
      aborted = true
      plugin?.stop().catch(() => {})
      end()
    },
  }
}
