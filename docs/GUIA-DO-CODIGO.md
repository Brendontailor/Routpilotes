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
- `data/open-address-tiles-index.js` informa quais células abertas existem; `data/open-address-tiles/` guarda os arquivos JSON carregados sob demanda.
- `js/open-address-tiles.js` calcula as células que cruzam o mapa, evita downloads repetidos e mantém somente os pontos visíveis no renderizador.
- `js/address-radius.js` controla o círculo de 100 a 500 metros, a lista de números e as referências no raio.

A cópia local pode ser atualizada com `node scripts/update-osm-address-snapshot.mjs`. O script consulta o Overpass, filtra os resultados pelos contornos existentes e nunca cria números ausentes.

Os dados abertos IBGE/Overture podem ser regenerados com `node scripts/generate-open-address-tiles.mjs <pasta-dos-geojsonseq>`. A pasta de entrada deve conter os recortes baixados pelo cliente oficial Overture e descritos em `data/open-address-tiles/README.md`.

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

## Comparação e rotas locais

- `js/comparison.js` controla a comparação de 2 a 24 locais no desktop e mantém o fluxo de dois locais no mobile.
- `js/local-routing.js` procura rua e número na base local, carrega a malha somente no primeiro cálculo e executa o menor caminho no navegador.
- `js/route-planner.js` mantém a origem, os atendimentos, a ordem atual, a ordem recomendada e o histórico de uma alteração.
- `js/route-distance.js` cria e reutiliza a matriz de distâncias sem repetir cálculos.
- `js/route-optimizer.js` usa vizinho mais próximo e 2-opt para sugerir uma sequência; posições marcadas como fixas não mudam na reotimização.
- `js/route-map.js` desenha origem, paradas e segmentos em uma camada Leaflet separada.
- `data/routing/road-network.json` contém nós e conexões dirigidas; `address-streets.json` indexa todas as vias também por cidade/região e os fragmentos `addresses-*.json` resolvem números sem geocodificação externa.
- `data/routing-index.js` registra versão, origem e contagens da base.
- `scripts/generate-local-routing-data.mjs` regenera esses arquivos a partir de um recorte GeoJSONSeq do tema `transportation` da Overture.

O RoutePilot não envia endereços para serviços de rota. O Service Worker guarda a malha depois do primeiro uso, sem incluí-la no app shell inicial.

A ordem manual tem precedência: arraste um atendimento para a posição desejada e use `Posição fixa` quando uma nova otimização não puder movê-lo. Não existe prioridade automática alta, média ou baixa.

## Compartilhamento geográfico

- `js/sharing.js` abre a central de compartilhamento a partir de coordenadas, áreas e paradas do planejador.
- `js/location-share-core.js` elimina campos não geográficos e monta os três formatos de mensagem.
- `js/landmark-ranking.js` escolhe até três referências próximas, úteis e sem duplicidade.
- O WhatsApp Web é aberto sem contato predefinido; o nome do cliente armazenado na Agenda nunca é incluído na mensagem geográfica.

## Pesquisa e navegação

- `js/search.js` cria `INDICE_PESQUISA` e calcula a correspondência exata, parcial e aproximada.
- Debounce e limite de resultados ficam em `CONFIGURACAO_PESQUISA`.
- `js/navigation.js` troca cidade, região, localidade e painel contextual.
- `js/map-point-actions.js` contém as ações de clique direito no mapa.

### Busca híbrida do cadastro de atendimento

- `js/work-order-search.js` normaliza o texto e consulta primeiro o catálogo local.
- `js/geocoding-core.js` converte todos os resultados ao mesmo formato, deduplica e aplica o ranking próprio.
- `js/geocoding-providers.js` contém os adaptadores HTTP separados de Photon e Geoapify.
- `js/geocoding-service.js` controla a ordem local → Photon → Geoapify, cache temporário, cancelamento e fallback manual.
- `js/runtime-config.js` contém apenas configuração pública gerada no deploy; nunca deve receber uma chave privada.
- `netlify/functions/geocode.mjs` é o proxy opcional que lê `GEOAPIFY_API_KEY` somente no servidor do Netlify.
- `CONFIGURACAO_GEOCODIFICACAO`, em `js/config.js`, centraliza debounce, limites, timeout, pontuações e URLs.

Quando a base local oferece um resultado forte, nenhuma API externa é consultada. Photon amplia buscas fracas ou ausentes. Geoapify é usado somente quando configurado e necessário. Falhas externas não impedem a confirmação de resultado local ou de um ponto manual.

O cache híbrido fica somente em memória, usa consulta normalizada + contexto + provider e expira por TTL. A OS salva as coordenadas confirmadas e não repete a geocodificação durante agenda ou roteamento. Somente o texto do endereço é enviado aos providers; nome do cliente, observação, telefone e demais dados operacionais não são transmitidos.

## Service Worker e PWA

- `manifest.webmanifest` define nome, ícones, cores e modo instalável.
- `service-worker.js` lista os arquivos essenciais em `APP_SHELL` e usa estratégia network-first para arquivos locais.
- Sempre que um arquivo do aplicativo for criado ou alterado, confirme que ele está em `APP_SHELL` e aumente a versão de `CACHE_NAME`.
- Tiles do OpenStreetMap não devem ser adicionados ao cache em massa.

## Ordens de serviço e agenda

- `js/scheduling-config.js`: técnicos padrão, turnos, duração e carga dos tipos de serviço.
- `js/scheduling-core.js`: valida capacidade e horários, distribui OS e gera lembretes de deslocamento entre cidades.
- `js/agenda-storage.js`: isola o IndexedDB usado por técnicos, OS e agenda diária.
- `js/agenda-ui.js`: formulário, distribuição, prévia, grade diária e gerenciamento da equipe no desktop.
- `js/agenda-map.js`: desenha marcadores e uma camada de rota separada por técnico e turno.
- `js/work-order-search.js`: corrige abreviações somente para comparação, pontua candidatos locais e evita que respostas antigas substituam buscas novas.
- `js/work-order-import.js`: extrai cliente, assunto, técnico, data, horário, endereço e bairro do texto externo; login e campos sem uso são descartados.
- `js/agenda-filters.js`: mantém seleção, padrão e vínculos dos filtros pelos IDs dos técnicos.

A base do técnico orienta a distribuição, mas nunca bloqueia outra cidade. O aviso de deslocamento é informativo e a OS permanece alocada quando as demais regras forem válidas.

Na Agenda, OS não agendadas ficam na gaveta lateral recolhível. Ao arrastar uma OS para outro técnico, `js/agenda-ui.js` pede confirmação e `js/scheduling-core.js` recalcula as rotas afetadas antes de salvar. A ação `Sugerir técnico ideal` compara apenas encaixes válidos e mantém a decisão final com o usuário.

## Onde alterar

| Necessidade | Arquivo principal |
| --- | --- |
| Zoom, timeout, debounce ou limites | `js/config.js` |
| Aparência | `css/routepilot.css` |
| Inicialização e camadas | `js/map.js` |
| Busca | `js/search.js` |
| Números, blocos e Overpass | `js/osm-addresses.js` |
| Atualizar a base local de números OSM | `scripts/update-osm-address-snapshot.mjs` |
| Gerar células de endereços IBGE/Overture | `scripts/generate-open-address-tiles.mjs` |
| Foco em um raio | `js/address-radius.js` |
| Regiões e localidades | `data/regions.js`, `data/locations.js` |
| Contornos | `data/boundaries.js` |
| Comparação e cálculo por estradas | `js/comparison.js`, `js/local-routing.js` |
| Planejador de vários atendimentos | `js/route-planner.js`, `js/route-optimizer.js`, `js/route-distance.js`, `js/route-map.js` |
| Ordens de serviço e agenda diária | `js/scheduling-config.js`, `js/scheduling-core.js`, `js/agenda-storage.js`, `js/agenda-ui.js`, `js/agenda-map.js` |
| Busca tolerante de uma OS | `js/work-order-search.js`, `js/local-routing.js` |
| Importação de texto de uma OS | `js/work-order-import.js`, `js/agenda-ui.js` |
| Providers e ranking geográfico | `js/geocoding-core.js`, `js/geocoding-providers.js`, `js/geocoding-service.js` |
| Configuração opcional do Geoapify | `js/runtime-config.js`, `netlify/functions/geocode.mjs`, `netlify.toml` |
| Filtros visuais da Agenda | `js/agenda-filters.js`, `js/agenda-storage.js`, `js/agenda-ui.js` |
| Compartilhamento e referências | `js/sharing.js`, `js/location-share-core.js`, `js/landmark-ranking.js` |
| Gerar malha e índice local | `scripts/generate-local-routing-data.mjs` |
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
