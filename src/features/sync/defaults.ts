import { Platform } from 'react-native';

/** On the web build served by the sync server itself, the server is the page's own origin. */
export const defaultServerUrl = (): string => (Platform.OS === 'web' && typeof location !== 'undefined' ? location.origin : '');
