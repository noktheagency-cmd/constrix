const STATIC_CACHE='constrix-static-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(STATIC_CACHE).then(cache=>cache.addAll(['/offline.html','/manifest.webmanifest','/favicon.svg'])));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('constrix-static-')&&key!==STATIC_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // No API data, uploads, mutations, or private responses enter the cache.
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));return;}
 if(url.pathname.startsWith('/assets/')||['/favicon.svg','/manifest.webmanifest'].includes(url.pathname))event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(STATIC_CACHE).then(cache=>cache.put(request,copy));}return response;})));
});
