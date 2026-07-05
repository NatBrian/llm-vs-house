import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = path.resolve(dir, '../../packages/engine/src/index.ts');
const coreSrc = path.resolve(dir, '../../packages/core/src/index.ts');

// The workspace source packages use ESM `.js` import specifiers that actually point
// at `.ts` files. Bundling their SOURCE (rather than dist) keeps dev fast, so this
// tiny resolver rewrites those relative `.js` specifiers to their `.ts` sibling.
function tsJsExtension(): Plugin {
  return {
    name: 'ts-js-extension',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.') || !source.endsWith('.js')) return null;
      if (!/packages\/(core|engine)\/src/.test(importer)) return null;
      const candidate = path.resolve(path.dirname(importer), source.slice(0, -3) + '.ts');
      return fs.existsSync(candidate) ? candidate : null;
    },
  };
}

export default defineConfig({
  plugins: [tsJsExtension(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@casino/engine': engineSrc,
      '@casino/core': coreSrc,
    },
  },
  server: { port: 5173, strictPort: true },
});
