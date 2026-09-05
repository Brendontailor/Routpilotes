/* Recurso RoutePilot: prepara somente configuracoes publicas durante o build. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const geoapifyConfigured=Boolean(process.env.GEOAPIFY_API_KEY);
const proxyUrl=geoapifyConfigured?'/.netlify/functions/geocode':'';
const contents=`/* Configuracao publica gerada no deploy. Nunca grave segredos neste arquivo. */
globalThis.ROUTEPILOT_RUNTIME_CONFIG=Object.freeze({
  geoapifyApiKey:'',
  geoapifyProxyUrl:${JSON.stringify(proxyUrl)}
});
`;

fs.writeFileSync(path.join(root,'js','runtime-config.js'),contents,'utf8');
console.info(`Configuracao do Geoapify: ${geoapifyConfigured?'proxy Netlify habilitado':'nao configurado'}.`);
