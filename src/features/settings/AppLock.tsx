import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Button, Text } from '@/components/ui';
import { getLockEmail, isLockEnabled, verifyPin } from './lock';
import { Field } from '@/components/ui';

/** Gate rendered above the whole app. Does nothing unless the user turned the lock on. */
export function AppLock({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [bio, setBio] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => { void getLockEmail().then(setEmail); }, []);

  useEffect(() => { void isLockEnabled().then((on) => setLocked(on)); }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'background') void isLockEnabled().then((on) => on && setLocked(true)); });
    return () => sub.remove();
  }, []);
  useEffect(() => { if (Platform.OS !== 'web') void LocalAuthentication.hasHardwareAsync().then(async (h) => setBio(h && (await LocalAuthentication.isEnrolledAsync()))); }, []);

  const tryBio = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock FitTrack' });
    if (r.success) setLocked(false);
  }, []);
  const submit = async () => {
    if (await verifyPin(pin)) { setLocked(false); setPin(''); setErr(null); } else setErr('Wrong PIN');
  };

  if (locked === null) return null;
  if (!locked) return <>{children}</>;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 14, backgroundColor: '#0B0F14' }}>
      <Text variant="h1" style={{ color: '#fff' }}>FitTrack is locked</Text>
      {email ? <Text variant="muted" style={{ color: '#9AA7B8' }}>Saved on this device for {email}</Text> : null}
      <Field label="PIN" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" error={err} onSubmitEditing={submit} autoFocus />
      <Button title="Unlock" onPress={submit} />
      {bio ? <Button title="Use biometrics" variant="secondary" onPress={tryBio} /> : null}
    </View>
  );
}
