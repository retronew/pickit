// Makes PickIt installable (and so a share target on Android). It caches
// nothing on purpose: the app sits behind sign-in and deploys often, so
// every request goes to the network as if there were no worker.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
