import puppeteer from 'puppeteer-core';

async function runPerformanceTest() {
  console.log("=========================================");
  console.log("🚀 STARTING 4-PLAYER MULTIPLAYER PERFORMANCE TEST...");
  console.log("=========================================");
  
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: [
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    // Create 4 isolated browser contexts to ensure completely separate player sessions/cookies
    const contexts = [
      await browser.createBrowserContext(),
      await browser.createBrowserContext(),
      await browser.createBrowserContext(),
      await browser.createBrowserContext()
    ];

    const pages: { name: string; page: any }[] = [];
    const roles = ['Host', 'Client 1', 'Client 2', 'Client 3'];
    
    // Create pages for each context
    for (let i = 0; i < 4; i++) {
      const p = await contexts[i].newPage();
      await p.setViewport({ width: 1280, height: 720 });
      
      // Let console logs and errors propagate to our test runner console with player prefix
      p.on('console', msg => console.log(`🖥️ [${roles[i]} CONSOLE] ${msg.text()}`));
      p.on('pageerror', err => console.error(`🛑 [${roles[i]} EXCEPTION] ${err.message}`));
      p.on('error', err => console.error(`⚠️ [${roles[i]} ERROR] ${err.message}`));
      
      pages.push({ name: roles[i], page: p });
    }

    const hostPageObj = pages[0];
    const clientPages = pages.slice(1);

    // 1. Find an open map and secure Host role
    let chosenMap = '';
    const mapsToTry = ['The ZigZag', 'Quantum Bypass', 'The Spiral'];
    
    for (const m of mapsToTry) {
      console.log(`⏳ Attempting to join map "${m}" as Host...`);
      await hostPageObj.page.goto(`http://gtd-frontend-dev:5173/game.html?map=${encodeURIComponent(m)}&role=host&headless=false`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for asset loader
      await hostPageObj.page.waitForFunction(() => {
        const loader = document.getElementById('loader-screen');
        return !loader || loader.classList.contains('hidden') || loader.style.display === 'none';
      }, { timeout: 15000 }).catch(() => {});

      // Verify if we are indeed the Host
      const isHost = await hostPageObj.page.evaluate(() => {
        return (window as any).state?.isHost === true;
      });

      if (isHost) {
        chosenMap = m;
        console.log(`🟢 Successfully joined map "${m}" as the active HOST!`);
        break;
      } else {
        console.log(`🟡 Map "${m}" already has an active host. Trying next map...`);
      }
    }

    if (!chosenMap) {
      console.log("⚠️ Could not secure exclusive Host role on any maps. Proceeding with last attempted map anyway...");
      chosenMap = mapsToTry[mapsToTry.length - 1];
    }

    // 2. Load Clients one by one to avoid registration race conditions
    for (const cp of clientPages) {
      console.log(`⏳ Loading ${cp.name} on Dev Server for map "${chosenMap}"...`);
      await cp.page.goto(`http://gtd-frontend-dev:5173/game.html?map=${encodeURIComponent(chosenMap)}&role=client&headless=false`, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      console.log(`✅ ${cp.name} loaded: ${cp.page.url()}`);
      
      // Wait for asset loader
      await cp.page.waitForFunction(() => {
        const loader = document.getElementById('loader-screen');
        return !loader || loader.classList.contains('hidden') || loader.style.display === 'none';
      }, { timeout: 30000 }).catch(() => {
        console.log(`⚠️ ${cp.name} timeout waiting for loader-screen. Proceeding...`);
      });
    }

    // 3. Wait for all 4 players to be synced and connected in the lobby
    console.log("⏳ Waiting for lobby synchronization (>= 4 players)...");
    for (const pObj of pages) {
      await pObj.page.waitForFunction(() => {
        const counterEl = document.getElementById('playerCounter');
        if (!counterEl) return false;
        const match = counterEl.innerText.match(/\d+/);
        return match && parseInt(match[0]) >= 4;
      }, { timeout: 30000 }).then(() => {
        console.log(`👥 Connection verified for ${pObj.name}`);
      }).catch(() => {
        console.log(`⚠️ Timeout waiting for 4 players connection on ${pObj.name}. Proceeding anyway...`);
      });
    }

    // 4. Set up FPS tracing in all 4 page contexts
    console.log("🎬 Setting up FPS tracing in all 4 browser contexts...");
    const fpsTrackerScript = `
      window.perfStats = {
        fpsValues: [],
        frameTimes: [],
        ticks: 0,
        startTime: performance.now()
      };
      
      let lastTime = performance.now();
      function measure() {
        const now = performance.now();
        const dt = now - lastTime;
        lastTime = now;
        
        window.perfStats.ticks++;
        if (window.perfStats.ticks > 15) { // Skip warm-up frames
          window.perfStats.frameTimes.push(dt);
          window.perfStats.fpsValues.push(1000 / dt);
        }
        requestAnimationFrame(measure);
      }
      requestAnimationFrame(measure);
    `;

    for (const pObj of pages) {
      await pObj.page.evaluate(fpsTrackerScript);
    }

    console.log("🚀 Triggering Stress-Test / Benchmark Mode from Host...");
    const clickSuccess = await hostPageObj.page.evaluate(() => {
      const btn = document.getElementById('modStartBenchmarkBtn');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!clickSuccess) {
      throw new Error("Could not find '#modStartBenchmarkBtn' on Host page to start the benchmark!");
    }

    console.log("🔥 Benchmark Mode started! Simulating waves and generating 100+ towers (synced to clients)...");

    // Let the benchmark run for 12 seconds to collect enough data points under heavy load
    const duration = 12000;
    const interval = 1500;
    let elapsed = 0;

    console.log("\n--- Realtime Multi-Player Telemetry ---");
    while (elapsed < duration) {
      await new Promise(resolve => setTimeout(resolve, interval));
      elapsed += interval;

      const telemetryQuery = `(() => {
        const state = window.state;
        const fps = window.perfStats.fpsValues;
        const currentFps = fps.length > 0 ? Math.round(fps[fps.length - 1]) : 60;
        
        return {
          wave: state?.wave || 0,
          towerCount: state?.towers?.length || 0,
          enemyCount: state?.activeEnemies?.length || 0,
          fps: currentFps,
          lives: state?.lives || 0,
          gold: state?.gold || 0
        };
      })()`;

      const hostData = await hostPageObj.page.evaluate(telemetryQuery) as any;
      const c1Data = await clientPages[0].page.evaluate(telemetryQuery) as any;
      const c2Data = await clientPages[1].page.evaluate(telemetryQuery) as any;
      const c3Data = await clientPages[2].page.evaluate(telemetryQuery) as any;

      console.log(
        `⏱️ [${(elapsed / 1000).toFixed(1)}s] | ` +
        `Host: ${hostData.fps} FPS (${hostData.towerCount}🗼/${hostData.enemyCount}👾) | ` +
        `C1: ${c1Data.fps} FPS (${c1Data.towerCount}🗼) | ` +
        `C2: ${c2Data.fps} FPS (${c2Data.towerCount}🗼) | ` +
        `C3: ${c3Data.fps} FPS (${c3Data.towerCount}🗼) | ` +
        `🌊 Wave: ${hostData.wave}`
      );
    }

    console.log("\n--- Analyzing Performance Metrics for all Players ---");
    
    const analysisScript = `(() => {
      const stats = window.perfStats;
      const fpsVals = stats.fpsValues;
      const times = stats.frameTimes;

      if (fpsVals.length === 0) return { error: "No FPS data collected." };

      const avgFps = fpsVals.reduce((a, b) => a + b, 0) / fpsVals.length;
      const minFps = Math.min(...fpsVals);
      const maxFps = Math.max(...fpsVals);
      
      const avgFrameTime = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((a, b) => a + Math.pow(b - avgFrameTime, 2), 0) / times.length;
      const stdDevFrameTime = Math.sqrt(variance);

      const microStutters = times.filter(t => t > 33.3).length;
      const severeStutters = times.filter(t => t > 50.0).length;

      return {
        avgFps: Math.round(avgFps),
        minFps: Math.round(minFps),
        maxFps: Math.round(maxFps),
        jitterMs: stdDevFrameTime.toFixed(2),
        totalFrames: times.length,
        microStutters,
        severeStutters
      };
    })()`;

    const reports: Record<string, any> = {};
    for (const pObj of pages) {
      reports[pObj.name] = await pObj.page.evaluate(analysisScript);
    }

    console.log("================================================================================");
    console.log("📊 MULTI-PLAYER PERFORMANCE COMPARISON REPORT");
    console.log("================================================================================");
    console.log("Metric             | Host         | Client 1     | Client 2     | Client 3     ");
    console.log("--------------------------------------------------------------------------------");
    console.log(
      `⭐ Average FPS     | ` +
      `${reports['Host'].avgFps.toString().padEnd(12)} | ` +
      `${reports['Client 1'].avgFps.toString().padEnd(12)} | ` +
      `${reports['Client 2'].avgFps.toString().padEnd(12)} | ` +
      `${reports['Client 3'].avgFps.toString().padEnd(12)}`
    );
    console.log(
      `📉 Minimum FPS     | ` +
      `${reports['Host'].minFps.toString().padEnd(12)} | ` +
      `${reports['Client 1'].minFps.toString().padEnd(12)} | ` +
      `${reports['Client 2'].minFps.toString().padEnd(12)} | ` +
      `${reports['Client 3'].minFps.toString().padEnd(12)}`
    );
    console.log(
      `📈 Maximum FPS     | ` +
      `${reports['Host'].maxFps.toString().padEnd(12)} | ` +
      `${reports['Client 1'].maxFps.toString().padEnd(12)} | ` +
      `${reports['Client 2'].maxFps.toString().padEnd(12)} | ` +
      `${reports['Client 3'].maxFps.toString().padEnd(12)}`
    );
    console.log(
      `⏱️ Frame Jitter     | ` +
      `${(reports['Host'].jitterMs + " ms").padEnd(12)} | ` +
      `${(reports['Client 1'].jitterMs + " ms").padEnd(12)} | ` +
      `${(reports['Client 2'].jitterMs + " ms").padEnd(12)} | ` +
      `${(reports['Client 3'].jitterMs + " ms").padEnd(12)}`
    );
    console.log(
      `⚠️ Micro-Stutters  | ` +
      `${reports['Host'].microStutters.toString().padEnd(12)} | ` +
      `${reports['Client 1'].microStutters.toString().padEnd(12)} | ` +
      `${reports['Client 2'].microStutters.toString().padEnd(12)} | ` +
      `${reports['Client 3'].microStutters.toString().padEnd(12)}`
    );
    console.log(
      `🛑 Severe Lags     | ` +
      `${reports['Host'].severeStutters.toString().padEnd(12)} | ` +
      `${reports['Client 1'].severeStutters.toString().padEnd(12)} | ` +
      `${reports['Client 2'].severeStutters.toString().padEnd(12)} | ` +
      `${reports['Client 3'].severeStutters.toString().padEnd(12)}`
    );
    console.log("================================================================================");

    for (const pName of Object.keys(reports)) {
      const rep = reports[pName];
      console.log(`👤 ${pName.toUpperCase()} RESULT:`);
      if (rep.avgFps >= 55 && rep.severeStutters === 0) {
        console.log("🟢 EXCELLENT (Smooth 60 FPS gameplay, no noticeable lag!)");
      } else if (rep.avgFps >= 45 && rep.severeStutters < 10) {
        console.log("🟡 ACCEPTABLE (Playable, but slight rendering stutter detected under high load)");
      } else {
        console.log("🔴 POOR (Significant FPS drops or lag spikes detected. Needs optimization!)");
      }
      console.log("--------------------------------------------------------------------------------");
    }

  } catch (err: any) {
    console.error("❌ Error running multiplayer performance test:", err);
  } finally {
    await browser.close();
    console.log("🧹 Cleanup: Browser closed.");
  }
}

runPerformanceTest();
