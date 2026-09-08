/* Gera o cliente local de login sem carregar bibliotecas por CDN. */
import {build} from 'esbuild';

await build({
  entryPoints:['scripts/auth-provider-entry.mjs'],
  outfile:'vendor/netlify-identity.js',
  bundle:true,
  format:'iife',
  platform:'browser',
  target:['es2020'],
  minify:true,
  legalComments:'none'
});

console.info('Cliente Netlify Identity atualizado.');
