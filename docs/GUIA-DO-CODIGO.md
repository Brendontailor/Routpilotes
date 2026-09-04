# Guia do código do RoutePilot

Este guia indica onde começar e qual arquivo alterar. O RoutePilot usa JavaScript simples, Leaflet local e dados carregados por arquivos na ordem declarada em `index.html`.

## Início do mapa

- `index.html` monta a interface e carrega os scripts.
- `js/events.js` inicia os eventos da aplicação.
- `js/map.js`, na função `initMap`, cria o mapa Leaflet, os painéis, marcadores e contornos.
- `js/config.js` contém o centro e os níveis de zoom usados pelo mapa.

## Casas e blocos

- `js/osm-addresses.js` busca e desenha `addr:housenumber` e identificações explícitas de bloco.
- Números em nós OSM podem ser associados ao polígono do prédio que os contém ou ao prédio próximo, respeitando o limite configurado.
- `data/coab-duque-addresses.js` contém apenas os pontos verificados da fonte fornecida para a COAB Duque.
- `data/osm-address-snapshot.js` mantém uma cópia local dos números OSM encontrados dentro das regiões operacionais.
- `js/address-radius.js` controla o círculo de 100 a 500 metros, a lista de números e as referências no raio.

A cópia local pode ser atualizada com `node scripts/update-osm-address-snapshot.mjs`. O script consulta o Overpass, filtra os resultados pelos contornos existentes e nunca cria números ausentes.

Nunca criar número, bloco ou coordenada por suposição. Tags externas como `addr:housenumber`, `building`, `name` e `ref` mantêm seus nomes originais.

## Overpass

- `js/osm-addresses.js` monta a consulta em `montarConsultaOverpass` e executa os fallbacks em `consultarOverpass`.
- Os endpoints, timeout e limites ficam em `CONFIGURACAO_OVERPASS`, dentro de `js/config.js`.
- A consulta usa somente o trecho visível do mapa. Os servidores públicos podem ficar lentos ou indisponíveis.
- Quando uma consulta falha, o sistema pode reutilizar a última resposta local salva para aquele trecho.

## Zoom

- Zoom geral, clique detalhado e limite máximo: `CONFIGURACAO_MAPA` em `js/config.js`.
- Zoom mínimo dos números e perfis de quantidade de rótulos: `CONFIGURACAO_OVERPASS`.
- Zoom e raios do foco de endereços: `CONFIGURACAO_FOCO_ENDERECOS`.
- Ao clicar em um ponto, `identifyCoordinates` em `js/area-inspector.js` nunca reduz o zoom atual.

## Cache

- Respostas Overpass usam memória e `localStorage`; duração, prefixo e quantidade máxima ficam em `CONFIGURACAO_OVERPASS`.
- Anotações operacionais usam IndexedDB por meio de `js/notes-storage.js`.
- O cache do aplicativo offline é separado e pertence ao `service-worker.js`.

## Regiões e localidades

- `data/regions.js`: regiões operacionais e relacionamentos próximos.
- `data/locations.js`: bairros, localidades e pontos pesquisáveis.
- `data/boundaries.js`: contornos GeoJSON.
- `data/routes.js`: vias desenhadas no mapa.
- `data/map-details.js`: vias detalhadas e pontos de referência.
- `js/references.js`: regras espaciais e exibição desses dados.

Cada lugar deve manter um ID interno único. O nome mostrado ao usuário não pode ser usado como única identificação.

## Pesquisa e navegação

- `js/search.js` cria `INDICE_PESQUISA` e calcula a correspondência exata, parcial e aproximada.
- Debounce e limite de resultados ficam em `CONFIGURACAO_PESQUISA`.
- `js/navigation.js` troca cidade, região, localidade e painel contextual.
- `js/map-point-actions.js` contém as ações de clique direito no mapa.

## Service Worker e PWA

- `manifest.webmanifest` define nome, ícones, cores e modo instalável.
- `service-worker.js` lista os arquivos essenciais em `APP_SHELL` e usa estratégia network-first para arquivos locais.
- Sempre que um arquivo do aplicativo for criado ou alterado, confirme que ele está em `APP_SHELL` e aumente a versão de `CACHE_NAME`.
- Tiles do OpenStreetMap não devem ser adicionados ao cache em massa.

## Onde alterar

| Necessidade | Arquivo principal |
| --- | --- |
| Zoom, timeout, debounce ou limites | `js/config.js` |
| Aparência | `css/routepilot.css` |
| Inicialização e camadas | `js/map.js` |
| Busca | `js/search.js` |
| Números, blocos e Overpass | `js/osm-addresses.js` |
| Atualizar a base local de números OSM | `scripts/update-osm-address-snapshot.mjs` |
| Foco em um raio | `js/address-radius.js` |
| Regiões e localidades | `data/regions.js`, `data/locations.js` |
| Contornos | `data/boundaries.js` |
| Comparação | `js/comparison.js` |
| Street View | `js/streetview.js` |
| Anotações | `js/notes-storage.js`, `js/notes-ui.js` |
| PWA/offline | `manifest.webmanifest`, `service-worker.js` |

## Verificação antes de publicar

Execute na raiz do projeto:

```bash
node scripts/validate-routepilot-v2.mjs .
node scripts/validate-routepilot-refactored.mjs .
```

Depois abra o sistema por servidor HTTP e confira o console, o mapa, a busca, as camadas, os números e o funcionamento offline.
