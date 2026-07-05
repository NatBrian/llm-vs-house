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
      if (!/packages\/(core|engine|llm)\/src/.test(importer)) return null;
      const candidate = path.resolve(path.dirname(importer), source.slice(0, -3) + '.ts');
      return fs.existsSync(candidate) ? candidate : null;
    },
  };
}

// Runs the serverless /api/decide handler inside the Vite dev server, so LLM mode
// works locally exactly as it does on Vercel/Netlify (Vite alone serves no functions).
function apiDevServer(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/decide' || req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', async () => {
          try {
            const mod = await server.ssrLoadModule('/server/handler.ts');
            const payload = JSON.parse(body || '{}');
            const { status, json } = await mod.handleDecide(payload);
            res.statusCode = status;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(json));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [tsJsExtension(), apiDevServer(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@casino/engine': engineSrc,
      '@casino/core': coreSrc,
    },
  },
  server: { port: 5173, strictPort: true },
});
