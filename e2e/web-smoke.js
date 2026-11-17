// Browser smoke test against a served `dist` build (see DEVELOPMENT.md). Requires playwright.
// node scripts/serve-dist.js & node e2e/web-smoke.js [baseUrl]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8099';
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const text = async (pg) => (await pg.innerText('body')).replace(/\n/g, ' | ');

(async () => {
  const b = await chromium.launch();
  // 1. Cold start reliability: the database must open on every fresh browser profile.
  let ok = 0;
  for (let i = 0; i < 8; i++) {
    const c = await b.newContext(); const p = await c.newPage();
    await p.goto(base, { waitUntil: 'load' });
    for (let k = 0; k < 20; k++) { await p.waitForTimeout(500); if (/Welcome to FitTrack|could not open/.test(await p.innerText('body'))) break; }
    if (/Welcome to FitTrack/.test(await p.innerText('body'))) ok++;
    await c.close();
  }
  console.log(`cold start: ${ok}/8`); if (ok !== 8) fail('database did not open on every cold start');

  // 2. Profile -> persists across reload -> workout -> PR -> history persists.
  const ctx = await b.newContext({ viewport: { width: 420, height: 1600 } }); const pg = await ctx.newPage();
  const errors = []; pg.on('pageerror', (e) => errors.push(e.message)); pg.on('dialog', (d) => d.accept());
  const go = async (path) => { await pg.goto(base + path, { waitUntil: 'load' }); await pg.waitForTimeout(3000); };
  await go('/');
  await pg.getByLabel('Full name').fill('Smoke Test'); await pg.getByLabel('Date of birth').fill('1995-06-15');
  await pg.getByLabel('Height (cm)').fill('178'); await pg.getByLabel('Weight (kg)').fill('80');
  await pg.getByRole('button', { name: 'Start tracking' }).click(); await pg.waitForTimeout(2500);
  if (new URL(pg.url()).pathname !== '/') fail('onboarding did not navigate home: ' + pg.url());
  await go('/'); if (!/Good (morning|afternoon|evening)|Late night/.test(await text(pg))) fail('profile did not persist across reload');

  await go('/workouts');
  await pg.getByRole('button', { name: 'Start empty workout' }).click(); await pg.waitForTimeout(1500);
  await pg.getByRole('button', { name: '+ Add exercise' }).click(); await pg.waitForTimeout(1200);
  await pg.getByLabel('Search').fill('barbell bench'); await pg.waitForTimeout(800);
  await pg.getByRole('button', { name: 'Barbell Bench Press' }).first().click(); await pg.waitForTimeout(1500);
  await pg.getByLabel('Set 1 weight (kg)').fill('60'); await pg.getByLabel('Set 1 weight (kg)').blur();
  await pg.getByLabel('Set 1 reps').fill('8'); await pg.getByLabel('Set 1 reps').blur(); await pg.waitForTimeout(500);
  await pg.getByRole('checkbox', { name: 'Mark set 1 complete' }).click(); await pg.waitForTimeout(800);
  await pg.getByRole('button', { name: 'Finish', exact: true }).click(); await pg.waitForTimeout(600);
  await pg.getByRole('button', { name: 'Save workout' }).click(); await pg.waitForTimeout(2500);
  const detail = await text(pg);
  if (!/VOLUME \| 480 kg/.test(detail)) fail('workout volume wrong: ' + detail.slice(0, 200));
  await go('/records'); if (!/Heaviest \| 2026|Heaviest/.test(await text(pg)) || !/60 kg/.test(await text(pg))) fail('PR not detected');
  await go('/workouts'); if (!/480 kg/.test(await text(pg))) fail('history did not persist');
  if (errors.length) fail('page errors: ' + errors.slice(0, 3).join(' ; '));
  console.log(process.exitCode ? 'FAILED' : 'web smoke test passed');
  await b.close();
})();
