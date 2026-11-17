import fs from 'node:fs';
import path from 'node:path';

const appDir = path.resolve(__dirname, 'app');

function routeFiles(dir = appDir, prefix = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return routeFiles(path.join(dir, e.name), `${prefix}${e.name}/`);
    return /\.tsx$/.test(e.name) ? [`${prefix}${e.name.replace(/\.tsx$/, '')}`] : [];
  });
}
const files = routeFiles();
/** Normalises an Expo Router file path to the route pattern it serves. */
const toPattern = (f: string) => f.replace(/\(.*?\)\//g, '').replace(/\/index$/, '').replace(/^index$/, '') || '/';
const patterns = files.map(toPattern).filter((p) => !p.startsWith('_'));
const matches = (href: string) => {
  const clean = href.split('?')[0]!.replace(/\/$/, '') || '/';
  return patterns.some((p) => {
    const re = new RegExp('^/?' + p.replace(/\[[^\]]+\]/g, '[^/]+') + '$');
    return re.test(clean.replace(/^\//, '')) || (clean === '/' && p === '/');
  });
};

describe('navigation', () => {
  it('every screen declared in the root and tab layouts has a file', () => {
    for (const layout of ['_layout.tsx', '(tabs)/_layout.tsx']) {
      const src = fs.readFileSync(path.join(appDir, layout), 'utf8');
      const names = [...src.matchAll(/<(?:Stack|Tabs)\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]!);
      const base = layout.startsWith('(tabs)') ? '(tabs)/' : '';
      for (const n of names) {
        const exists = files.includes(`${base}${n}`) || files.includes(`${base}${n}/index`);
        expect({ layout, screen: n, exists }).toEqual({ layout, screen: n, exists: true });
      }
    }
  });

  it('every literal router.push / replace / Redirect target resolves to a real route', () => {
    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.tsx?$/.test(e.name) || /\.test\./.test(e.name)) continue;
        const src = fs.readFileSync(p, 'utf8');
        for (const m of src.matchAll(/(?:push|replace|navigate)\(\s*['"`]([^'"`$]+)['"`]/g)) if (m[1]!.startsWith('/') && !matches(m[1]!)) bad.push(`${path.relative(__dirname, p)} -> ${m[1]}`);
        for (const m of src.matchAll(/(?:pathname:|href=|href:)\s*['"`](\/[^'"`$]*)['"`]/g)) if (!matches(m[1]!)) bad.push(`${path.relative(__dirname, p)} -> ${m[1]}`);
      }
    };
    walk(path.resolve(__dirname));
    expect(bad).toEqual([]);
  });

  it('has the five bottom tabs from the product brief', () => {
    for (const t of ['index', 'workouts', 'activity', 'progress', 'profile']) expect(files).toContain(`(tabs)/${t}`);
  });
});
