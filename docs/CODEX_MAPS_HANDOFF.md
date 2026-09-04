# RoutePilot — handoff para Codex: números de imóveis e blocos

## Objetivo

Finalizar e validar a camada de endereçamento do RoutePilot para mostrar **números de casas/imóveis em qualquer cidade onde o OpenStreetMap possua `addr:housenumber`**, sem manter uma lista fixa de municípios. A camada deve continuar leve, sem backend e sem API paga.

A implementação-base já está em `js/osm-addresses.js` e deve ser preservada/melhorada, não reescrita no `index.html`.

## O que já está pronto

- Camada global `Números de imóveis e blocos (OSM · zoom 17+)`.
- Consulta dinâmica por `bbox` do mapa, então funciona fora de Pelotas também.
- Busca `addr:housenumber` em nodes/ways/relations e edifícios na área visível.
- Número de endereço centralizado sobre o prédio quando o endereço é do próprio edifício.
- Para endereço em node, tentativa de associação ao prédio que contém o ponto; se estiver ligeiramente deslocado, associação ao prédio mais próximo em até 24 m.
- Remoção de duplicatas.
- Controle simples de colisão de rótulos, priorizando blocos.
- Blocos somente quando houver tag explícita/forte (`addr:block`, `building:block`, `name/ref` contendo `Bloco ...` etc.). Não inventar numeração.
- Perímetro destacado para prédio identificado como bloco.
- Debounce de movimento/zoom.
- Cache em memória + `localStorage` com TTL de 12 h.
- Fallback entre múltiplos endpoints Overpass.
- Limite de rótulos renderizados por viewport.
- API de diagnóstico `window.RoutePilotAddressDebug` com `reload()`, `clearCache()`, `query()`, endpoints e áreas prioritárias.
- Service Worker atualizado para `routepilot-shell-v9`.

## Regra principal

**Não existe garantia de numeração para 100% das casas.** Exibir o número quando ele estiver disponível no OpenStreetMap ou em outra fonte pública/permitida que venha a ser integrada. Nunca fabricar números pela ordem dos prédios.

O objetivo é cobertura máxima automática para todas as cidades possíveis, com ausência de rótulo quando a fonte não possuir o dado.

## Prioridade: COAB Duque — Pelotas/RS

Google My Maps fornecido pelo usuário para orientação:

`https://www.google.com/maps/d/u/0/viewer?mid=1magOvp7KOB5IVGFVID5kfyEqWcs&ll=-31.739243353752904%2C-52.38847121655026&z=20`

Centro:

- latitude: `-31.739243353752904`
- longitude: `-52.38847121655026`
- zoom: `20`

Esses dados estão também em `data/priority-areas.js`.

O link é referência visual/geográfica. Não depender de scraping da interface do Google Maps e não usar Google Maps JavaScript API paga.

## O que o Codex deve terminar

1. Executar o projeto localmente e testar a camada em várias cidades e bairros, não apenas Pelotas.
2. Verificar no navegador se Overpass aceita as consultas atuais e ajustar sintaxe/timeout se necessário.
3. Testar áreas densas; se a resposta ficar pesada, dividir o viewport em células ou reduzir o conjunto de `building` consultado sem perder a associação dos endereços.
4. Testar colisões em zoom 17, 18 e 19, inclusive em notebook e mobile.
5. Garantir que o número permaneça sobre a construção correta ao mover/zoomar.
6. Verificar edifícios multipolígonos/relações OSM. Se necessário, melhorar o centroide para multipolígonos.
7. Na COAB Duque, identificar cada footprint de bloco e cruzar com fonte confiável para `Bloco I`, `Bloco II`, etc. Se o My Maps puder ser exportado pelo usuário para KML/KMZ, preferir importação/validação desse arquivo.
8. Se a numeração do bloco não puder ser comprovada, deixar somente o footprint/edifício sem inventar rótulo.
9. Considerar uma pequena ferramenta de administração/debug para clicar num prédio e mostrar OSM ID, tags, centro, `addr:housenumber`, `name`, `ref`, `addr:block` e GeoJSON; manter isso fora do fluxo normal do técnico.
10. Rodar os scripts de validação existentes e corrigir qualquer regressão.
11. Revisar PWA/Service Worker e cache após qualquer novo arquivo.

## Critérios de aceite

- Ao abrir qualquer cidade e aproximar para zoom 17+, números OSM disponíveis aparecem automaticamente.
- Não há dependência de cadastro manual por cidade.
- Não há rótulos duplicados óbvios.
- Rótulos não geram centenas de requisições durante pan/zoom.
- Falha de um endpoint Overpass não quebra o mapa.
- Falta de internet não quebra o shell da PWA; dados de endereço previamente cacheados podem reaparecer quando a mesma chave de viewport ainda existir no cache local.
- Nenhum bloco recebe número por adivinhação.
- COAB Duque é tratada como prioridade de validação, não como exceção hardcoded que impeça o recurso de funcionar no resto do país.

## Comandos finais

Antes de publicar:

```bash
node --check js/osm-addresses.js
node scripts/validate-routepilot-refactored.mjs .
node scripts/validate-routepilot-v2.mjs .
git status
git diff
```

Depois de revisar o diff:

```bash
git add .
git commit -m "feat: expand global house number and block mapping"
git push origin main
```

Mostrar o `git diff` final ao usuário antes do `git push`.
