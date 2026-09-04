# RoutePilot — handoff para Codex

## Objetivo
Finalizar e validar as melhorias de mapa já preparadas neste pacote.

## Repositório de referência
https://github.com/Brendontailor/Routpilotes.git

## Google My Maps de referência
https://www.google.com/maps/d/u/0/viewer?mid=1magOvp7KOB5IVGFVID5kfyEqWcs&ll=-31.739243353752904%2C-52.38847121655026&z=20

Área prioritária: COAB Duque, Pelotas/RS.
Centro aproximado: -31.739243353752904, -52.38847121655026.

## Já implementado

1. Camada global `Números de imóveis e blocos`.
2. Consulta dinâmica OpenStreetMap/Overpass em zoom alto, por bbox da tela.
3. Exibição de `addr:housenumber` sobre a construção quando possível.
4. Associação de endereço em nó ao prédio que o contém, ou ao prédio mais próximo em até 24 m.
5. Rótulos de blocos somente quando houver tag explícita/confiável. Não inventar numeração.
6. Perímetro visual de blocos identificados.
7. Debounce de consultas, cache em memória/localStorage e fallback entre endpoints Overpass.
8. Limite de rótulos e tratamento básico de colisão.
9. Layer toggle no painel de camadas.
10. Controle de zoom reposicionado para o canto inferior direito, maior e mais adequado para desktop/celular.
11. Service Worker atualizado para cache `routepilot-shell-v10`.

## O que você deve terminar

- Rodar o projeto e validar visualmente em várias cidades, não apenas Pelotas.
- Garantir que a solução continue city-agnostic: qualquer cidade com dados OSM deve funcionar.
- Testar zoom 17, 18 e 19 em áreas densas e rurais.
- Melhorar colisão/legibilidade dos números sem esconder excessivamente endereços válidos.
- Rever limites das consultas Overpass para evitar requests muito grandes e rate limit.
- Testar os fallbacks dos endpoints e erros de rede.
- Validar comportamento PWA/offline: os dados OSM dinâmicos não precisam existir offline, mas a aplicação não pode quebrar.
- Conferir posição do controle +/- em desktop e celular. Ele não deve conflitar com barra de ferramentas, Street View, attribution ou outros controles.
- Usar o Google My Maps acima apenas como referência visual/geográfica. Não criar dependência frágil de scraping da UI do Google.
- Na COAB Duque, identificar polígonos dos prédios e blocos. Só atribuir `Bloco 1`, `Bloco 2`, `Bloco A` etc. quando houver fonte confiável.
- Se houver dados validados externos, preferir GeoJSON local para os blocos da COAB Duque, com campo `source` documentado.

## Regra principal para números de casas

Queremos números nas casas em todas as cidades possíveis. Não use lista fixa de municípios. Consulte `addr:housenumber`, `addr:street`, `addr:place` e edifícios OSM do bbox visível. Se o endereço estiver em um nó separado, associe ao polígono correto sempre que possível.

## Arquivos principais alterados

- `js/osm-addresses.js`
- `js/map.js`
- `css/routepilot.css`
- `index.html`
- `service-worker.js`
- `docs/ROUTEPILOT_STATE.md`

## Antes de commit/push

1. Rode verificações de sintaxe JavaScript.
2. Abra o app localmente e verifique console.
3. Teste desktop e mobile.
4. Mostre `git diff` final.
5. Só depois faça commit.

Commit sugerido:

`feat: improve global house numbers, blocks and map zoom controls`
