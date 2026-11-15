// Only static synthetic datasets and application assets; never cache monitor APIs.
const CACHE = "kawsay-static-__BUILD__";
const ASSETS = ["/","/index.html","/app.js","/app.css","/manifest.webmanifest","/icon.svg",
  "/data/crew.json","/data/vitals.json","/data/daily.json","/data/environment.json","/data/manifest.json"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("kawsay-static-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||url.origin!==self.location.origin||!ASSETS.includes(url.pathname))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    // One coherent app/data version, refreshed by the next service-worker install.
    return (await cache.match(url.pathname)) || fetch(event.request);
  }));
});
