// Service Worker for BudgetNext PWA
const CACHE_NAME = "budgetnext-pwa-v2"
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon.svg",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  // Only intercept GET requests
  if (event.request.method !== "GET") return

  const url = new URL(event.request.url)

  // 1. Static Assets & External Logos (Stale-While-Revalidate)
  const isImageOrFont =
    url.hostname.includes("flagcdn.com") ||
    url.hostname.includes("tradingview.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2")

  if (isImageOrFont) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
            }
            return networkResponse
          })
          .catch(() => cachedResponse)

        return cachedResponse || fetchPromise
      })
    )
    return
  }

  // 2. Skip dynamic API calls from overriding local transactions state
  if (url.pathname.startsWith("/api/")) {
    return
  }

  // 3. HTML Pages (Network first with cache fallback)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/")
          }
        })
      })
  )
})
