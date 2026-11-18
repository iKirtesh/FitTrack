import Constants from 'expo-constants';

const LATEST = 'https://api.github.com/repos/iKirtesh/FitTrack/releases/latest';
export type UpdateCheck =
  | { status: 'available'; build: number; current: number; url: string }
  | { status: 'current'; current: number }
  | { status: 'error'; reason: string };

/** Compares this build's versionCode (1000 + CI run number) with the newest GitHub release. Needs internet; never runs in the background. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  try {
    const current = Number(Constants.expoConfig?.android?.versionCode ?? 0);
    const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return { status: 'error', reason: `GitHub answered ${res.status}. Try again later.` };
    const rel = (await res.json()) as { tag_name?: string; assets?: { name: string; browser_download_url: string }[] };
    const n = /^apk-(\d+)$/.exec(rel.tag_name ?? '')?.[1];
    const asset = rel.assets?.find((a) => a.name === 'FitTrack-latest.apk');
    if (!n || !asset) return { status: 'error', reason: 'The latest release has no APK.' };
    const build = 1000 + Number(n);
    return build > current ? { status: 'available', build, current, url: asset.browser_download_url } : { status: 'current', current };
  } catch (e) {
    return { status: 'error', reason: `Could not reach GitHub (${e instanceof Error ? e.message : String(e)}). Check your internet connection.` };
  }
}
