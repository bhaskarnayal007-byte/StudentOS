// Files shared to Student OS from another app (WhatsApp → Share → Student OS).
//
// Android posts them here because of share_target in the manifest. A service
// worker can't reach the app's storage or the signed-in user, so it parks the
// files in Cache Storage and sends the app to Notes, which picks them up and
// files them like any dropped file. Loaded into the generated sw.js via
// workbox importScripts, ahead of workbox's own routes.

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return

  event.respondWith((async () => {
    const form = await event.request.formData()
    const cache = await caches.open('shared-files')
    for (const file of form.getAll('files')) {
      if (!(file instanceof File)) continue
      await cache.put(
        `/shared/${crypto.randomUUID()}`,
        new Response(file, {
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            // Names can be any Unicode; headers can't.
            'X-File-Name': encodeURIComponent(file.name),
          },
        }),
      )
    }
    return Response.redirect('/notes?shared=1', 303)
  })())
})
