import React, { useEffect, useState } from 'react';
import { Linking, Platform, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import { checkForUpdate } from '@/services/updates';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, ChipRow, Divider, Field, Row, Screen, SectionHeader, Segmented, Text } from '@/components/ui';
import { DASHBOARD_CARDS, DEFAULT_CARDS, type DashboardCardId } from '@/constants/dashboard';
import { WEEKDAYS } from '@/constants/profile';
import { useDbMutation, useDbQuery, useRepos } from '@/hooks/data';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { AUTO_KEY, applyHealthImport } from '@/features/health/sync';
import { importFromHealthConnect } from '@/services/healthconnect';
import { disableLock, getLockEmail, isGmail, isLockEnabled, lockIsSecureStorage, setLockEmail, setPin } from '@/features/settings/lock';
import { cancelIds, ensurePermission, notificationsSupported, scheduleReminder } from '@/services/notifications';
import { confirm, errorMessage, notify } from '@/services/dialogs';
import { reminderSchema } from '@/types/schemas';
import type { Reminder } from '@/database/repositories/reminders';

const KINDS = [['workout', 'Workout', 'Time to train'], ['activity', 'Activity', 'Get your steps in'], ['water', 'Water', 'Drink some water'], ['weight', 'Weigh-in', 'Log your weight'], ['goal', 'Goal check-in', 'Check your goal progress']] as const;
const two = (n: number) => String(n).padStart(2, '0');

export default function Settings() {
  const router = useRouter();
  const repos = useRepos();
  const { mode, setMode } = useTheme();
  const { data } = useDbQuery(['settings'], (r) => ({ cards: r.settings.get<DashboardCardId[]>('dashboard.cards', DEFAULT_CARDS), reminders: r.reminders.list() }));
  const [lock, setLock] = useState(false);
  const [pin, setPinText] = useState('');
  const [email, setEmail] = useState('');
  const [emailSaved, setEmailSaved] = useState<string | null>(null);
  useEffect(() => { void getLockEmail().then((e) => { setEmailSaved(e); setEmail(e ?? ''); }); }, []);
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('workout');
  const [time, setTime] = useState('18:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  useEffect(() => { void isLockEnabled().then(setLock); }, []);

  const autoHc = repos.settings.get<boolean>(AUTO_KEY, false);
  const toggleHc = useDbMutation(async (r, _: void) => {
    if (r.settings.get<boolean>(AUTO_KEY, false)) { r.settings.set(AUTO_KEY, false); return; }
    const res = await importFromHealthConnect(7, true); // asks for permission once
    if (!res.ok) { notify('Health Connect', res.reason); return; }
    applyHealthImport(r, res.data);
    r.settings.set(AUTO_KEY, true);
  });
  const setCards = useDbMutation((r, c: DashboardCardId[]) => r.settings.set('dashboard.cards', c));
  const apply = async (rem: Reminder, enabled: boolean) => {
    await cancelIds(rem.notificationIds);
    if (enabled) {
      if (!(await ensurePermission())) { notify('Notifications are off', 'Allow notifications for FitTrack in system settings to get reminders.'); repos.reminders.setEnabled(rem.id, false); return; }
      repos.reminders.setNotificationIds(rem.id, await scheduleReminder(rem));
    } else repos.reminders.setNotificationIds(rem.id, []);
    repos.reminders.setEnabled(rem.id, enabled);
  };
  const toggle = useDbMutation(async (_r, a: { rem: Reminder; on: boolean }) => apply(a.rem, a.on));
  const addRem = useDbMutation(async (r, _: void) => {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
    if (!m) throw new Error('Time must be HH:MM (24 hour)');
    const k = KINDS.find((x) => x[0] === kind)!;
    const rem = r.reminders.create(reminderSchema.parse({ kind, title: k[1], body: k[2], hour: Number(m[1]), minute: Number(m[2]), daysOfWeek: days }));
    if (notificationsSupported) await apply(rem, true);
  });
  const delRem = useDbMutation(async (r, rem: Reminder) => { await cancelIds(rem.notificationIds); r.reminders.remove(rem.id); });
  const saveLock = async () => { try { await setPin(pin); setLock(true); setPinText(''); notify('App lock enabled', 'FitTrack will ask for your PIN when you open it. If you forget it you will have to clear the app data, which deletes your records, so keep a backup.'); } catch (e) { notify('Could not set PIN', errorMessage(e)); } };

  if (!data) return null;
  const cards = data.cards;
  return (
    <Screen>
      <Card>
        <SectionHeader title="Appearance" />
        <Segmented<ThemeMode> value={mode} onChange={setMode} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </Card>

      <Card>
        <SectionHeader title="Dashboard cards" />
        <Text variant="muted">Choose which cards appear on Home.</Text>
        {DASHBOARD_CARDS.map((c) => (
          <Row key={c.id} style={{ justifyContent: 'space-between' }}>
            <Text>{c.label}</Text>
            <Switch accessibilityLabel={c.label} value={cards.includes(c.id)} onValueChange={(on) => setCards.mutate(DASHBOARD_CARDS.map((x) => x.id).filter((id) => (id === c.id ? on : cards.includes(id))))} />
          </Row>
        ))}
      </Card>

      <Card>
        <SectionHeader title="Reminders" />
        {!notificationsSupported ? <Text variant="muted">Scheduled notifications are only available in the Android and iOS apps. On web, reminders are saved but cannot alert you.</Text> : null}
        {data.reminders.map((rem) => (
          <View key={rem.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}><Text>{rem.title} · {two(rem.hour)}:{two(rem.minute)}</Text><Text variant="muted">{rem.daysOfWeek.length === 7 ? 'Every day' : rem.daysOfWeek.map((d) => WEEKDAYS[d]).join(' ')}</Text></View>
              <Switch accessibilityLabel={`${rem.title} reminder`} value={rem.enabled} onValueChange={(on) => toggle.mutate({ rem, on })} />
              <Button title="✕" variant="danger" onPress={() => delRem.mutate(rem)} />
            </Row><Divider />
          </View>
        ))}
        <ChipRow>{KINDS.map((k) => <Chip key={k[0]} label={k[1]} selected={kind === k[0]} onPress={() => setKind(k[0])} />)}</ChipRow>
        <ChipRow>{WEEKDAYS.map((w, i) => <Chip key={w} label={w} selected={days.includes(i)} onPress={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))} />)}</ChipRow>
        <Field label="Time (24h)" value={time} onChangeText={setTime} autoCapitalize="none" />
        <Button title="Add reminder" disabled={days.length === 0} onPress={() => addRem.mutate()} />
      </Card>

      {Platform.OS === 'android' ? (
        <Card>
          <SectionHeader title="App updates" />
          <Text variant="muted">Build {Constants.expoConfig?.android?.versionCode ?? 'unknown'}. Checks GitHub for a newer APK. Android still asks you to confirm the install; your data is kept.</Text>
          <Button title="Check for updates" variant="secondary" onPress={async () => {
            const r = await checkForUpdate();
            if (r.status === 'error') notify('Update check failed', r.reason);
            else if (r.status === 'current') notify('Up to date', `You have the newest build (${r.current}).`);
            else if (await confirm('Update available', `Build ${r.build} is ready (you have ${r.current}). Download it now? Open the downloaded file to install.`, 'Download')) void Linking.openURL(r.url);
          }} />
        </Card>
      ) : null}

      {Platform.OS === 'android' ? (
        <Card>
          <SectionHeader title="Health Connect" />
          <Text variant="muted">When on, FitTrack imports the last 7 days of steps and weight from Health Connect when you open the app (at most every 15 minutes). It does not sync in the background while the app is closed.</Text>
          <Button title={autoHc ? 'Turn off auto sync' : 'Turn on auto sync'} variant={autoHc ? 'secondary' : 'primary'} onPress={() => toggleHc.mutate()} />
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="App lock" />
        <Text variant="muted">{lockIsSecureStorage ? 'A PIN stored in your device keystore. It keeps casual snoopers out; it does not encrypt your data.' : 'On web the PIN is kept in browser storage, which is weak protection. Treat it as a convenience only.'}</Text>
        <Field label="Gmail address (optional, shown on the lock screen)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={email && !isGmail(email) ? 'Enter a valid Gmail address' : null} />
        <Text variant="muted">Saved only on this device. It is a label, not a Google sign-in: it is not verified and never leaves your phone.</Text>
        <Button title={emailSaved && !email ? 'Remove email' : 'Save email'} variant="secondary" disabled={(!!email && !isGmail(email)) || (email.trim().toLowerCase() === (emailSaved ?? ''))} onPress={async () => { try { await setLockEmail(email.trim() || null); setEmailSaved(email.trim().toLowerCase() || null); notify('Saved', email.trim() ? 'Email saved on this device.' : 'Email removed.'); } catch (e) { notify('Could not save email', errorMessage(e)); } }} />
        {lock ? <Button title="Turn off app lock" variant="secondary" onPress={async () => { await disableLock(); setLock(false); }} /> : (
          <><Field label="New PIN (4-8 digits)" value={pin} onChangeText={setPinText} keyboardType="number-pad" secureTextEntry maxLength={8} /><Button title="Enable app lock" disabled={pin.length < 4} onPress={saveLock} /></>
        )}
      </Card>

      <Card>
        <SectionHeader title="Privacy" />
        <Text variant="muted">FitTrack has no account, no server and no analytics. Everything is stored in a database on this {Platform.OS === 'web' ? 'browser' : 'device'}. Location is used only while you track an activity and is never sent anywhere.</Text>
        <Text variant="muted">Uninstalling the app{Platform.OS === 'web' ? ' or clearing browser site data' : ''} can erase your data. Export a backup first.</Text>
        <Button title="Backup, restore & delete data" onPress={() => router.push('/backup')} />
      </Card>
    </Screen>
  );
}
