/// <reference lib="WebWorker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope & typeof globalThis & {
  __WB_MANIFEST: Array<{ revision?: string | null; url: string }>
}

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
