import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

/**
 * Saves text as a file the user can keep. Web triggers a browser download; native writes to the
 * cache directory and opens the system share sheet (Save to Files / Drive / email / etc.).
 */
export async function saveTextFile(filename: string, content: string, mime = 'application/json'): Promise<'downloaded' | 'shared' | 'unavailable'> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: filename, UTI: mime === 'application/json' ? 'public.json' : 'public.comma-separated-values-text' });
  return 'shared';
}

/** Lets the user pick a file and returns its text, or null if cancelled. */
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  if (Platform.OS === 'web' && a.file) return { name: a.name, text: await a.file.text() };
  return { name: a.name, text: await new File(a.uri).text() };
}
