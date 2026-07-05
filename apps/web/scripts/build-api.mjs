// Bundles the serverless function (server/decide.ts) into a single self-contained
// file at api/decide.js, inlining the @casino/* workspace packages so the deployed
// function never depends on pnpm's symlinked node_modules layout at runtime.
import esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url)); // apps/web/scripts
const web = path.resolve(dir, '..');
const pkgSrc = (p) => path.resolve(web, `../../packages/${p}/src/index.ts`);

// Rewrite the workspace packages' `.js` ESM specifiers to their real `.ts` files.
const tsJsPlugin = {
  name: 'ts-js-ext',
  setup(build) {
    build.onResolve({ filter: /\.js$/ }, (args) => {
      if (!args.importer || !args.path.startsWith('.')) return null;
      if (!/packages\/(core|engine|llm)\/src/.test(args.importer)) return null;
      const candidate = path.resolve(path.dirname(args.importer), args.path.slice(0, -3) + '.ts');
      return fs.existsSync(candidate) ? { path: candidate } : null;
    });
  },
};

await esbuild.build({
  entryPoints: [path.resolve(web, 'server/decide.ts')],
  outfile: path.resolve(web, 'api/decide.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  alias: {
    '@casino/engine': pkgSrc('engine'),
    '@casino/core': pkgSrc('core'),
    '@casino/llm': pkgSrc('llm'),
  },
  plugins: [tsJsPlugin],
  banner: { js: '// AUTO-GENERATED from server/decide.ts by scripts/build-api.mjs — do not edit.' },
  logLevel: 'info',
});

console.log('built api/decide.js');
