export interface Palette {
  bg: string; surface: string; surfaceAlt: string; border: string;
  text: string; textMuted: string; primary: string; primaryText: string; onPrimary: string;
  success: string; warning: string; danger: string; accent: string; track: string;
}

/** All text/background pairs below meet WCAG AA (4.5:1) for body text. */
export const light: Palette = {
  bg: '#F4F6F8', surface: '#FFFFFF', surfaceAlt: '#EBEFF3', border: '#DDE3EA',
  text: '#0E1621', textMuted: '#546275', primary: '#FF964F', primaryText: '#B4520C', onPrimary: '#2B1400',
  success: '#157A3C', warning: '#9A5B00', danger: '#C0262D', accent: '#C2410C', track: '#DDE3EA',
};
export const dark: Palette = {
  bg: '#0B0F14', surface: '#151B23', surfaceAlt: '#1E2630', border: '#2A3441',
  text: '#F2F5F8', textMuted: '#9AA7B8', primary: '#FF964F', primaryText: '#FF964F', onPrimary: '#2B1400',
  success: '#4ADE80', warning: '#FBBF24', danger: '#FF6B6B', accent: '#FFC59B', track: '#2A3441',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
export const font = { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, xxl: 36 } as const;
export const MIN_TOUCH = 44;
