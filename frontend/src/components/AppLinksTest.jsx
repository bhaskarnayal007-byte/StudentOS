// TEMPORARY: open /applinks on the phone, tap each button, note which ones open
// the real app. The winners go into lib/nativeApp.js, then this file goes.
// No fallbacks on purpose: a link that doesn't work should visibly do nothing.

const APPS = [
  ['Gmail', 'com.google.android.gm', 'mail.google.com/mail/', 'googlegmail://'],
  ['Docs', 'com.google.android.apps.docs.editors.docs', 'docs.google.com/document/', 'googledocs://'],
  ['Drive', 'com.google.android.apps.docs', 'drive.google.com/drive/', 'googledrive://'],
  ['Classroom', 'com.google.android.apps.classroom', 'classroom.google.com/', 'googleclassroom://'],
  ['Notion', 'notion.id', 'www.notion.so/', 'notion://'],
  ['Duolingo', 'com.duolingo', 'www.duolingo.com/', 'duolingo://'],
  ['YouTube', 'com.google.android.youtube', 'www.youtube.com/', 'youtube://'],
  ['WhatsApp', 'com.whatsapp', 'wa.me/', 'whatsapp://'],
  ['Instagram', 'com.instagram.android', 'www.instagram.com/', 'instagram://'],
  ['Spotify', 'com.spotify.music', 'open.spotify.com/', 'spotify://'],
]

const go = url => { window.location.href = url }

export default function AppLinksTest() {
  return (
    <div className="legal">
      <h1>App link test</h1>
      <p>Tap each button. Write down which ones open the real app.</p>
      {APPS.map(([name, pkg, path, scheme]) => (
        <section key={name}>
          <h2>{name}</h2>
          <div className="row">
            <button onClick={() => go(`intent://launch?id=${pkg}#Intent;scheme=market;package=com.android.vending;end`)}>A · Play launch</button>
            <button onClick={() => go(`intent://${path}#Intent;scheme=https;package=${pkg};end`)}>B · Web link</button>
            <button onClick={() => go(scheme)}>C · App scheme</button>
          </div>
        </section>
      ))}
    </div>
  )
}
