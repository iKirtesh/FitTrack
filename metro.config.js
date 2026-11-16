const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');
// expo-sqlite on web ships a wasm binary; metro must treat it as an asset.
config.resolver.assetExts.push('wasm');
// SharedArrayBuffer (needed by wasm sqlite) requires cross-origin isolation in dev.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  },
};
module.exports = config;
