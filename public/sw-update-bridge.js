/* Reload clients from builds that predate the controllerchange update handler. */
const bingoUpdateCapabilityCache = 'bingo-update-capability';

self.addEventListener('install', (event) => {
  const shellRequests = ['./', './display.html', './controller.html']
    .map((path) => new Request(new URL(path, self.location.href), { cache: 'reload' }));
  event.waitUntil(caches.open('html-shells').then((cache) => cache.addAll(shellRequests)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.length === 0) return;

    const capabilityCache = await caches.open(bingoUpdateCapabilityCache);
    const legacyChecks = await Promise.all(windows.map(async (client) => ({
      client,
      isLegacy: !(await capabilityCache.match(client.url)),
    })));
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const legacyClients = legacyChecks.filter(({ isLegacy }) => isLegacy).map(({ client }) => client);
    setTimeout(() => {
      for (const client of legacyClients) void client.navigate(client.url);
    }, 0);
  })());
});
