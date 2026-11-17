import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
const app = JSON.parse(read('app.json')).expo;

describe('platform configuration', () => {
  it('declares Android, iOS and web targets with identifiers', () => {
    expect(app.ios.bundleIdentifier).toBeTruthy();
    expect(app.android.package).toBeTruthy();
    expect(app.web.bundler).toBe('metro');
  });

  it('explains every iOS privacy permission the app can request', () => {
    const plist = app.ios.infoPlist;
    for (const k of ['NSLocationWhenInUseUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSFaceIDUsageDescription']) expect(String(plist[k]).length).toBeGreaterThan(20);
  });

  it('requests only the Android permissions it needs, and no background location', () => {
    expect(app.android.permissions).toEqual(expect.arrayContaining(['ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS']));
    expect(app.android.permissions).not.toContain('ACCESS_BACKGROUND_LOCATION');
    expect(JSON.stringify(app.ios.infoPlist)).not.toMatch(/Always/);
  });

  it('is not claiming background tracking anywhere in user-facing config', () => {
    expect(app.ios.infoPlist.UIBackgroundModes).toBeUndefined();
    expect(JSON.stringify(app)).not.toMatch(/background(Location|Modes|Tracking)|foregroundService|FOREGROUND_SERVICE/i);
  });

  it('web deployment sends the isolation headers SQLite-on-web needs, and serves the worker as JS', () => {
    const v = JSON.parse(read('vercel.json'));
    const hdrs = JSON.stringify(v.headers);
    expect(hdrs).toContain('Cross-Origin-Opener-Policy');
    expect(hdrs).toContain('Cross-Origin-Embedder-Policy');
    expect(hdrs).toContain('/worker');
    expect(read('package.json')).toContain('postexport-web.js');
  });

  it('keeps native-only APIs behind platform guards', () => {
    const guarded: Record<string, RegExp> = {
      'src/services/notifications.ts': /Platform\.OS|notificationsSupported/,
      'src/services/pedometer.ts': /Platform\.OS|isAvailableAsync/,
      'src/features/settings/lock.ts': /Platform\.OS/,
    };
    for (const [f, re] of Object.entries(guarded)) expect({ f, guarded: re.test(read(f)) }).toEqual({ f, guarded: true });
  });

  it('never uses localStorage as the database (only for web lock state)', () => {
    const offenders: string[] = [];
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) return walk(p);
      if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) && /localStorage/.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(root, p));
    });
    walk(path.join(root, 'src'));
    expect(offenders.every((f) => /lock|reset|files/.test(f))).toBe(true);
  });
});
