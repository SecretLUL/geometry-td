import puppeteer, { Browser, Page, ConsoleMessage } from 'puppeteer-core';
import { roomStates, FRONTEND_URL } from './state';
import { ActiveBrowserInstance } from './types';

export const activeBrowsers: Record<string, ActiveBrowserInstance> = {};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export async function spawnHeadlessHost(roomId: string, mapName: string) {
  if (activeBrowsers[roomId] && activeBrowsers[roomId].status !== 'failed') return;

  const instanceId = Math.random().toString(36).substring(2, 15);
  console.log(`[HEADLESS] Launching headless host for room: ${roomId} (Map: ${mapName}, ID: ${instanceId})`);
  activeBrowsers[roomId] = {
    browser: null,
    page: null,
    status: 'launching',
    instanceId,
    launchStartedAt: Date.now()
  };

  let browser: Browser | null = null;
  try {
    browser = await withTimeout(
      puppeteer.launch({
        executablePath: '/usr/bin/chromium',
        args: [
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-renderer-backgrounding',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--mute-audio'
        ]
      }) as unknown as Promise<Browser>,
      30000,
      "Timeout while launching Puppeteer browser"
    );

    if (!activeBrowsers[roomId] || activeBrowsers[roomId].instanceId !== instanceId) {
      console.log(`[HEADLESS] Spawn for room ${roomId} cancelled (race condition detected after launch).`);
      if (browser) await browser.close();
      return;
    }

    const page: Page = await withTimeout(
      browser.newPage(),
      15000,
      "Timeout while opening a new browser tab"
    );

    if (!activeBrowsers[roomId] || activeBrowsers[roomId].instanceId !== instanceId) {
      console.log(`[HEADLESS] Spawn for room ${roomId} cancelled (race condition detected after newPage).`);
      if (browser) await browser.close();
      return;
    }

    await page.setViewport({ width: 1024, height: 1024 });

    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type() as string;
      const text = msg.text();
      const isProd = process.env.NODE_ENV === 'production';
      const isBenchmark = roomStates[roomId]?.benchmarkActive;

      if (isBenchmark) return;

      if (isProd) {
        if (type === 'warning') {
          console.warn(`[BROWSER WARN][Room ${roomId}]:`, text);
        } else if (type === 'error') {
          console.error(`[BROWSER ERROR][Room ${roomId}]:`, text);
        }
      } else {
        console.log(`[BROWSER LOG][Room ${roomId}]:`, text);
      }
    });
    page.on('error', (err: Error) => console.error(`[BROWSER ERROR][Room ${roomId}]:`, err));
    page.on('pageerror', (err: Error) => console.error(`[BROWSER PAGE-ERROR][Room ${roomId}]:`, err));

    const url = `${FRONTEND_URL}/game.html?map=${encodeURIComponent(mapName)}&headless=true&roomId=${encodeURIComponent(roomId)}`;
    console.log(`[HEADLESS] Loading URL: ${url}`);

    await withTimeout(
      page.goto(url, { waitUntil: 'networkidle2' }),
      30000,
      "Timeout while loading the frontend URL"
    );

    if (!activeBrowsers[roomId] || activeBrowsers[roomId].instanceId !== instanceId) {
      console.log(`[HEADLESS] Spawn for room ${roomId} cancelled (race condition detected after goto).`);
      if (browser) await browser.close();
      return;
    }

    activeBrowsers[roomId] = {
      browser,
      page,
      status: 'running',
      instanceId,
      launchStartedAt: activeBrowsers[roomId].launchStartedAt
    };
    console.log(`[HEADLESS] Headless host for room ${roomId} started successfully.`);
  } catch (err) {
    console.error(`[HEADLESS] Error starting headless host for room ${roomId}:`, err);
    if (activeBrowsers[roomId] && activeBrowsers[roomId].instanceId === instanceId) {
      delete activeBrowsers[roomId];
    }
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
            console.error(`[HEADLESS] Error closing browser in catch block for room ${roomId}:`, closeErr);
      }
    }
  }
}

export async function stopHeadlessHost(roomId: string) {
  const instance = activeBrowsers[roomId];
  if (!instance) return;

  console.log(`[HEADLESS] Stopping headless host for room: ${roomId}`);
  delete activeBrowsers[roomId];

  try {
    if (instance.browser) {
      await instance.browser.close();
    }
  } catch (err) {
    console.error(`[HEADLESS] Error stopping headless host for room ${roomId}:`, err);
  }
}

export async function runHeadlessHealthCheck() {
  const now = Date.now();
  for (const roomId of Object.keys(activeBrowsers)) {
    const instance = activeBrowsers[roomId];
    if (!instance) continue;

    if (instance.status === 'launching') {
      const duration = now - instance.launchStartedAt;
      if (duration > 45000) {
        console.warn(`[HEALTH-CHECK] Headless host for room ${roomId} has been stuck in 'launching' state for ${Math.round(duration / 1000)}s. Cleaning up...`);
        delete activeBrowsers[roomId];
        if (instance.browser) {
          try {
            await instance.browser.close();
          } catch (err) {
            console.error(`[HEALTH-CHECK] Error closing stuck browser for room ${roomId}:`, err);
          }
        }
      }
      continue;
    }

    const room = roomStates[roomId];
    const hasHumanPlayers = room && room.playerCount > 0;
    if (!hasHumanPlayers) {
      console.log(`[HEALTH-CHECK] No active human players remaining for room ${roomId}. Stopping orphaned headless browser.`);
      await stopHeadlessHost(roomId);
      continue;
    }

    if (instance.status === 'running' && instance.browser) {
      try {
        await withTimeout(
          instance.browser.version(),
          5000,
          "Browser is not responding"
        );
      } catch (err) {
        console.error(`[HEALTH-CHECK] Headless host for room ${roomId} is unresponsive or has crashed:`, err);
        await stopHeadlessHost(roomId);
        activeBrowsers[roomId] = {
          browser: null,
          page: null,
          status: 'failed',
          instanceId: instance.instanceId,
          launchStartedAt: instance.launchStartedAt
        };
      }
    }
  }
}
