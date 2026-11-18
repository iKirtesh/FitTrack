// Merge logic for the FitTrack LAN sync server. Pure and dependency-free so it can be unit tested.
// A backup envelope is { app, formatVersion, exportedAt, tables: { tableKey: row[] } }.
// Rule: UNION by primary key, first-seen row wins, nothing is ever deleted. Only one user profile is kept.
const keyOf = {
  appSettings: (r) => r.key,
  achievements: (r) => r.key,
  dailyActivity: (r) => r.date,
  gpsRoutePoints: (r) => `${r.sessionId}:${r.seq}`,
};
const pk = (table, row) => (keyOf[table] ? keyOf[table](row) : row.id);

function emptyEnvelope() { return { app: 'fittrack', formatVersion: 1, exportedAt: 0, tables: {} }; }

function mergeEnvelopes(base, incoming) {
  if (!incoming || incoming.app !== 'fittrack' || typeof incoming.tables !== 'object') throw new Error('Not a FitTrack backup');
  const out = { app: 'fittrack', formatVersion: Math.max(base.formatVersion || 1, incoming.formatVersion || 1), exportedAt: Date.now(), tables: {} };
  const names = new Set([...Object.keys(base.tables || {}), ...Object.keys(incoming.tables || {})]);
  let added = 0;
  for (const t of names) {
    const rows = [...(base.tables?.[t] ?? [])];
    const seen = new Set(rows.map((r) => pk(t, r)));
    for (const r of incoming.tables?.[t] ?? []) {
      const k = pk(t, r);
      if (k == null || seen.has(k)) continue;
      if (t === 'userProfiles' && rows.length >= 1) continue; // one profile only; the first device to sync wins
      seen.add(k); rows.push(r); added++;
    }
    out.tables[t] = rows;
  }
  return { merged: out, added };
}
module.exports = { mergeEnvelopes, emptyEnvelope };
