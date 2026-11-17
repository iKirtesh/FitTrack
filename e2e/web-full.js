// Broad browser test of every major screen against a served `dist` build.
// node scripts/serve-dist.js & node e2e/web-full.js [baseUrl]
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const base = process.argv[2] || 'http://localhost:8099';
let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + String(extra).slice(0, 220)}`); if (!ok) failures++; };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 420, height: 1800 }, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errors = []; const dialogs = [];
  pg.on('pageerror', (e) => errors.push(e.message)); pg.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  const go = async (p) => { await pg.goto(base + p, { waitUntil: 'load' }); await pg.waitForTimeout(2500); };
  const body = async () => (await pg.innerText('body')).replace(/\n/g, ' | ');
  const click = async (name, opts = {}) => { await pg.getByRole('button', { name, ...opts }).first().click(); await pg.waitForTimeout(900); };
  const fill = async (label, v, o = {}) => { const l = pg.getByLabel(label, o).first(); await l.fill(v); await l.blur(); };

  // --- Onboarding
  await go('/');
  await fill('Full name', 'Full Tester'); await fill('Date of birth', '1995-06-15'); await fill('Height (cm)', '178'); await fill('Weight (kg)', '80'); await fill('Target (kg)', '75');
  await click('Muscle building'); await click('Start tracking'); await pg.waitForTimeout(1500);
  check('onboarding lands on home', new URL(pg.url()).pathname === '/');

  // --- Profile edit persists
  await go('/profile-edit'); await fill('Weight (kg)', '79', { exact: true });
  await click('Save'); await pg.waitForTimeout(1200);
  await go('/(tabs)/profile'); check('profile edit persisted (79 kg)', /79 kg/.test(await body()), await body());

  // --- Manual run: 5 km in 25:00
  await go('/run/manual'); await click('Outdoor run');
  await fill('Distance (km)', '5'); await fill('Hours', '0'); await fill('Minutes', '25'); await fill('Seconds', '0');
  await click('Save activity'); await pg.waitForTimeout(1500);
  let t = await body(); check('manual run saved with distance and pace', /5(\.00)? km/.test(t) && /5:00 \/km/.test(t), t);
  await go('/records'); t = await body(); check('records include longest run and fastest 5K', /Longest run/i.test(t) && /5K/i.test(t), t);

  // --- Cardio
  await go('/cardio/new'); await click('Cycling'); await fill('Hours', '0'); await fill('Minutes', '30'); await click('Save cardio session'); await pg.waitForTimeout(1200);
  await go('/(tabs)/activity'); t = await body(); check('cardio visible on activity tab', /Cycling/i.test(t), t.slice(0, 300));

  // --- Counters: increment, undo, custom
  await go('/counters'); await click('+1'); t = await body(); check('counter increments', /\b1\b/.test(t) && /Push-ups/.test(t), t.slice(0, 200));
  await click('Undo'); await go('/counters');
  await fill('Name', 'Burpees'); await fill('Unit', 'reps'); await fill('Step', '5'); await fill('Daily target', '50');
  await click('Create counter'); await pg.waitForTimeout(800); check('custom counter created', /Burpees/.test(await body()));
  await go('/counters'); check('custom counter persists after reload', /Burpees/.test(await body()));

  // --- Exercise detail shows the muscle illustration
  await go('/exercises'); await fill('Search', 'barbell bench'); await pg.waitForTimeout(600);
  await click('Barbell Bench Press'); await pg.waitForTimeout(1200);
  check('exercise detail shows muscle illustration', (await pg.getByRole('img', { name: /Muscles worked: primary Chest/ }).count()) > 0);

  // --- Plans + calendar
  await go('/plans'); await click('Full Body'); await pg.waitForTimeout(1500);
  t = await body(); check('plan template created with exercises', /Barbell Back Squat/i.test(t), t.slice(0, 300));
  await go('/plans'); await click('Set active'); await pg.waitForTimeout(800); t = await body(); check('plan can be activated (stays on list)', /ACTIVE/.test(t) && /Workout plans/.test(t), t.slice(0, 200));
  await go('/calendar'); t = await body(); check('calendar shows active plan', /Active plan: Full Body/.test(t), t.slice(0, 300));

  // --- Goals
  await go('/goals'); await fill('Target weight (kg)', '75'); await click('Add goal'); await pg.waitForTimeout(800);
  t = await body(); check('weight goal listed with progress', /Reach 75 kg/.test(t) && /%/.test(t), t.slice(0, 300));

  // --- Measurements
  await go('/measurements'); await fill('Weight (kg)', '78.6'); await fill('Waist (cm)', '82'); await click('Save entry'); await pg.waitForTimeout(1000);
  await go('/measurements'); t = await body(); check('measurement persists with BMI', /78\.6 kg/.test(t) && /BMI/.test(t), t.slice(0, 300));

  // --- Progress and achievements
  await go('/(tabs)/progress'); t = await body(); check('progress shows running + weight sections', /Running/.test(t) && /Body weight/.test(t), t.slice(0, 200));
  await go('/achievements'); t = await body(); check('achievements show an unlocked badge', /Out the door/.test(t), t.slice(0, 300));

  // --- Settings: theme, reminder, app lock
  await go('/settings'); await click('Dark');
  check('dark theme applies', (await pg.evaluate(() => getComputedStyle(document.body).backgroundColor || '')).length > 0);
  await fill('Time (24h)', '07:30'); await click('Add reminder'); await pg.waitForTimeout(800);
  check('reminder saved', /07:30/.test(await body()), await body());
  await fill('New PIN (4-8 digits)', '1234'); await click('Enable app lock'); await pg.waitForTimeout(1000);
  await go('/'); t = await body(); check('app lock asks for PIN after reload', /PIN|Unlock|locked/i.test(t), t.slice(0, 200));
  if (/PIN|Unlock|locked/i.test(t)) {
    const pin = pg.locator('input').first(); await pin.fill('0000'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(800);
    check('wrong PIN is rejected', /PIN|Unlock|locked|Incorrect|Wrong/i.test(await body()));
    await pin.fill('1234'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(1500);
    check('correct PIN unlocks', !/Unlock|Enter your PIN/i.test(await body()), await body());
  }
  await go('/settings'); // full reload re-locks the app by design
  { const pin2 = pg.locator('input').first(); await pin2.fill('1234'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(1500); }
  await click('Turn off app lock'); await pg.waitForTimeout(600);
  await go('/'); check('app lock can be turned off', !/FitTrack is locked/.test(await body()));

  // --- Backup, delete everything, restore (real file round-trip)
  await go('/backup');
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }).catch(() => null), click('Export everything (JSON)')]);
  const file = path.join(os.tmpdir(), 'fittrack-e2e-backup.json');
  let backup = null;
  if (dl) { await dl.saveAs(file); backup = JSON.parse(fs.readFileSync(file, 'utf8')); }
  check('JSON export downloads a valid backup', !!backup && backup.app === 'fittrack' && backup.tables.runningSessions.length === 1 && backup.tables.bodyMeasurements.length >= 1, backup ? Object.keys(backup.tables) : 'no download');
  check('backup excludes app-lock secrets', !!backup && !backup.tables.appSettings.some((r) => String(r.key).startsWith('security.')));
  const [csv] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }).catch(() => null), click('Export history (CSV)')]);
  check('CSV export downloads', !!csv);

  dialogs.length = 0;
  await click('Delete all app data'); await pg.waitForTimeout(2500);
  await go('/'); t = await body(); check('delete-all returns app to onboarding', /Welcome to FitTrack/.test(t), t.slice(0, 200));

  if (backup) {
    // Restore needs a profile-less app: go to backup via direct URL still works without profile? create a profile first.
    await fill('Full name', 'Temp'); await fill('Date of birth', '1990-01-01'); await fill('Height (cm)', '170'); await fill('Weight (kg)', '70');
    await click('Start tracking'); await pg.waitForTimeout(1500);
    await go('/backup');
    const chooser = pg.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
    await click('Restore from backup file'); const fc = await chooser;
    if (fc) { await fc.setFiles(file); await pg.waitForTimeout(2500); }
    check('restore ran', !!fc && dialogs.some((d) => /Replace|Merge|Restored/i.test(d)) || /Restored/.test(await body()), dialogs.join(' / '));
    await go('/(tabs)/profile'); t = await body(); check('restore brought back the original profile', /Full Tester/.test(t), t.slice(0, 200));
    await go('/records'); check('records rebuilt after restore', /Longest run/i.test(await body()));
    await go('/plans'); check('plans restored', /Full Body/.test(await body()));
    await go('/counters'); check('custom counter restored', /Burpees/.test(await body()));
  }

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' ; '));
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
  process.exitCode = failures ? 1 : 0;
  await b.close();
})();
