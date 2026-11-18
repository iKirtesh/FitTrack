import React, { useState } from 'react';
import { Button, Card, Screen, SectionHeader, Text } from '@/components/ui';
import { useDbQuery, useInvalidateAll, useRepos } from '@/hooks/data';
import { dataSummary, exportAll, exportCsv, importBackup, validateBackup, type RestoreMode } from '@/features/backup/backup';
import { wipeAndReinitialise } from '@/database/client';
import { clearAllAppState } from '@/features/backup/reset';
import { pickTextFile, saveTextFile } from '@/services/files';
import { confirm, errorMessage, notify } from '@/services/dialogs';
import { localDay } from '@/utils/dates';

export default function Backup() {
  const repos = useRepos();
  const refresh = useInvalidateAll();
  const { data: sum } = useDbQuery(['data-summary'], (r) => dataSummary(r.db));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => { setBusy(true); setMsg(null); try { await fn(); } catch (e) { notify('Something went wrong', errorMessage(e)); } finally { setBusy(false); void refresh(); } };

  const exportJson = () => run(async () => {
    const file = exportAll(repos.db);
    const r = await saveTextFile(`fittrack-backup-${localDay()}.json`, JSON.stringify(file), 'application/json');
    setMsg(r === 'unavailable' ? 'Sharing is not available on this device.' : 'Backup created. Keep it somewhere safe: it contains all of your data (profile, workouts, routes, measurements).');
  });
  const exportCsvFiles = () => run(async () => {
    for (const f of exportCsv(repos.db)) await saveTextFile(f.filename, f.content, 'text/csv');
    setMsg('CSV files created: workouts, runs, cardio and measurements.');
  });
  const restore = () => run(async () => {
    const f = await pickTextFile();
    if (!f) return;
    let json: unknown;
    try { json = JSON.parse(f.text); } catch { throw new Error('That file is not valid JSON, so it cannot be a FitTrack backup.'); }
    const v = validateBackup(json);
    if (!v.ok) throw new Error(`Backup validation failed:\n${v.errors.slice(0, 5).join('\n')}`);
    const n = (k: string) => v.counts[k] ?? 0;
    const when = v.exportedAt ? new Date(v.exportedAt).toLocaleString() : 'unknown date';
    const mode: RestoreMode | null = (await confirm('Replace all current data?', `Backup from ${when}: ${n('workoutSessions')} workouts, ${n('runningSessions')} runs, ${n('bodyMeasurements')} measurements.\n\nOK = REPLACE everything on this device with the backup.\nCancel = next question (merge).`, 'Replace', true)) ? 'replace'
      : (await confirm('Merge instead?', 'Merge adds records from the backup and skips ones you already have. Nothing is deleted.', 'Merge')) ? 'merge' : null;
    if (!mode) return;
    const res = importBackup(repos.db, json, mode);
    setMsg(`Restored ${res.totalInserted} records${res.totalDuplicates ? `, skipped ${res.totalDuplicates} that already existed` : ''}.`);
  });
  const clearWorkouts = () => run(async () => {
    if (!(await confirm('Clear workout history?', `This deletes all ${sum?.workouts ?? 0} workouts and their sets. Runs, measurements and your profile are kept.`, 'Clear history', true))) return;
    repos.workouts.clearHistory(); setMsg('Workout history cleared.');
  });
  const deleteProfile = () => run(async () => {
    if (!(await confirm('Delete profile?', 'Your profile details are removed. Workouts, runs and measurements are kept. You will be asked to set up a new profile.', 'Delete profile', true))) return;
    repos.profile.remove(); setMsg('Profile deleted.');
  });
  const wipe = () => run(async () => {
    if (!(await confirm('Delete ALL data?', `This permanently deletes your profile, ${sum?.workouts ?? 0} workouts, ${sum?.runs ?? 0} runs, ${sum?.cardio ?? 0} cardio sessions, ${sum?.measurements ?? 0} measurements, plans, counters, settings and the app lock. It cannot be undone. Export a backup first if you might want anything back.`, 'Continue', true))) return;
    if (!(await confirm('Really delete everything?', 'Last chance. This cannot be undone.', 'Delete everything', true))) return;
    await clearAllAppState();
    await wipeAndReinitialise();
    notify('All data deleted', 'FitTrack is back to a fresh install.');
  });

  return (
    <Screen>
      <Card>
        <SectionHeader title="Your data" />
        <Text variant="muted">Stored only on this device: {sum?.workouts ?? 0} workouts · {sum?.runs ?? 0} runs · {sum?.cardio ?? 0} cardio · {sum?.measurements ?? 0} measurements. Uninstalling the app can remove it, so export a backup before you uninstall.</Text>
      </Card>
      <Card>
        <SectionHeader title="Export" />
        <Button title="Export everything (JSON)" loading={busy} onPress={exportJson} />
        <Button title="Export history (CSV)" variant="secondary" onPress={exportCsvFiles} />
        <Text variant="muted">JSON is a complete backup you can restore. CSV is for spreadsheets only. App-lock PINs are never included.</Text>
      </Card>
      <Card>
        <SectionHeader title="Restore" />
        <Button title="Restore from backup file" variant="secondary" onPress={restore} />
        <Text variant="muted">The file is checked before anything changes, and a restore is all-or-nothing.</Text>
      </Card>
      {msg ? <Text style={{ color: '#FF964F' }}>{msg}</Text> : null}
      <Card>
        <SectionHeader title="Delete" />
        <Button title="Clear workout history" variant="danger" onPress={clearWorkouts} />
        <Button title="Delete profile" variant="danger" onPress={deleteProfile} />
        <Button title="Delete all app data" variant="danger" onPress={wipe} />
      </Card>
    </Screen>
  );
}
