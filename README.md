# RoutePilot

RoutePilot é uma aplicação web instalável para consulta geográfica operacional e planejamento de visitas técnicas.

## Objetivo

O sistema ajuda a localizar um atendimento e compreender rapidamente:

- cidade;
- região operacional;
- bairro ou localidade;
- regiões próximas;
- referências e acessos conhecidos;
- distâncias por estradas calculadas localmente, com linha reta como contingência.

## Cobertura atual

O RoutePilot atende Pelotas, Capão do Leão, Morro Redondo, Canguçu e Cerrito.

- 5 cidades;
- 11 regiões operacionais;
- 105 localidades e pontos cadastrados;
- 25 contornos;
- 260 referências detalhadas;
- 444 vias cadastradas na camada detalhada.

## Principais funcionalidades

- mapa interativo com Leaflet e OpenStreetMap;
- navegação por cidade, região, bairro e localidade rural;
- busca inteligente, fuzzy e sem dependência de acentos;
- geocodificação híbrida com base local primeiro, Photon como ampliação e Geoapify opcional;
- consulta local dos 122.919 endereços integrados, com conferência opcional no Google Maps por link;
- busca e identificação por coordenadas;
- identificação de região com point-in-polygon;
- consulta de regiões e localidades próximas;
- comparação entre endereços ou locais com trajeto pela malha viária local;
- comparação dinâmica de 2 a 24 locais no desktop;
- planejamento de rota com origem separada, ordem sugerida, reordenação manual e posições fixas;
- comparação múltipla de regiões em linha reta;
- painel **Entender esta área**;
- consulta **Ver ao redor** com Haversine e raios configuráveis;
- Street View gratuito por URL do Google Maps;
- compartilhamento por deep link;
- central de compartilhamento geográfico com mensagem rápida, detalhada ou somente localização;
- anotações operacionais locais com estados pendente, validada e rejeitada;
- revisão e validação das anotações sem alterar o mapa automaticamente;
- ferramenta de revisão da qualidade dos dados;
- instalação como PWA e impressão em A4.

## Tecnologias

- HTML;
- CSS;
- JavaScript modular;
- Leaflet local;
- OpenStreetMap;
- IndexedDB;
- Service Worker;
- Netlify.

O projeto não exige framework, banco de dados, chave de API ou serviço pago. A função serverless do Netlify é opcional e serve apenas para proteger a chave do Geoapify quando esse complemento estiver habilitado.

## Execução local

Na raiz do projeto, execute:

```bash
python -m http.server 4173
```

Depois abra [http://localhost:4173](http://localhost:4173) no navegador.

O uso por servidor HTTP é recomendado para que o Service Worker, a PWA e os demais recursos do navegador funcionem corretamente. Não use apenas `file://` para validar o projeto.

## Deploy

O RoutePilot pode ser publicado no Netlify diretamente pelo repositório Git. A raiz de publicação contém `index.html`, `manifest.webmanifest`, `service-worker.js` e as pastas `css/`, `data/`, `js/` e `vendor/`. O arquivo `netlify.toml` mantém essa raiz e publica a função opcional de geocodificação.

Para habilitar o Geoapify sem expor a chave no navegador, crie no Netlify a variável de ambiente `GEOAPIFY_API_KEY`. O build configura o navegador para chamar `/.netlify/functions/geocode`; somente a função do Netlify lê o segredo. Nunca coloque o valor em `js/runtime-config.js`, `.env.example`, commits ou capturas de tela.

Sem essa variável, o sistema continua usando os 122.919 endereços locais, Photon e seleção manual no mapa.

ZIPs de publicação são artefatos gerados e não fazem parte do código-fonte versionado.

## Estrutura

```text
RoutePilot/
|-- index.html
|-- manifest.webmanifest
|-- service-worker.js
|-- css/
|-- data/
|-- js/
|-- netlify/functions/
|-- vendor/
|-- docs/
|-- scripts/
|-- AGENTS.md
|-- README.md
`-- .gitignore
```

### Onde fica cada parte

- `index.html`: estrutura da tela e ordem de carregamento dos módulos;
- `js/config.js`: zoom, debounce, cache e limites das consultas;
- `js/map.js`: inicialização do Leaflet e camadas do mapa;
- `js/osm-addresses.js`: números, blocos, cache e consultas Overpass;
- `data/osm-address-snapshot.js`: cópia local dos números OSM disponíveis nas regiões operacionais;
- `data/open-address-tiles-index.js`: índice leve das células de endereços abertos;
- `data/open-address-tiles/`: arquivos compactos carregados conforme o mapa visível;
- `js/local-routing.js`: busca de endereços e cálculo de menor caminho sem serviço externo;
- `js/route-planner.js`: estado e interface do planejador de vários atendimentos;
- `js/route-optimizer.js`: ordem sugerida e melhoria 2-opt, respeitando posições fixas;
- `js/route-distance.js`: matriz de distâncias e cache dos cálculos;
- `js/route-map.js`: camada independente da rota planejada no Leaflet;
- `js/scheduling-config.js` e `js/scheduling-core.js`: tipos de serviço, capacidade por turno, horários e distribuição das OS;
- `js/work-order-search.js`: normalização, ranking tolerante, cache e controle de respostas antigas na busca de OS;
- `js/work-order-import.js`: tratamento dos textos de OS copiados do sistema externo, sem guardar login ou campos extras;
- `js/geocoding-core.js`: modelo interno, ranking e deduplicação entre fontes;
- `js/geocoding-providers.js`: adaptadores independentes do Photon e Geoapify;
- `js/geocoding-service.js`: ordem local → Photon → Geoapify e fallback manual;
- `netlify/functions/geocode.mjs`: proxy opcional que mantém a chave Geoapify fora do cliente;
- `js/agenda-filters.js`: regras puras dos filtros visuais de técnicos;
- `js/agenda-storage.js`: persistência local de técnicos, OS e agendas no IndexedDB;
- `js/agenda-ui.js` e `js/agenda-map.js`: fluxo desktop de criação de rotas, gaveta de pendências, transferência entre técnicos, recomendação e agenda diária;
- `js/location-share-core.js` e `js/landmark-ranking.js`: mensagens geográficas e referências úteis;
- `data/routing/`: malha viária e índice fragmentado de ruas e números, carregados sob demanda;
- `data/`: regiões, localidades, contornos, vias e referências;
- `service-worker.js`: arquivos disponíveis no modo PWA/offline;
- `docs/GUIA-DO-CODIGO.md`: guia simples para manutenção do projeto.

## Limitações

- os tiles do OpenStreetMap exigem internet;
- as células de endereços IBGE/Overture são carregadas sob demanda e ficam disponíveis no cache após o primeiro acesso;
- Google Maps e Street View exigem internet;
- alguns limites rurais são contornos operacionais aproximados;
- a comparação de dois locais usa a malha viária local; se ela não puder calcular um caminho, o sistema identifica claramente o fallback em linha reta;
- a malha considera sentidos de circulação disponíveis na fonte, mas não substitui a conferência de bloqueios, obras ou condições atuais;
- informações operacionais cadastradas precisam ser revisadas antes de serem tratadas como validadas;
- as anotações ficam no IndexedDB do navegador e do computador atual enquanto não houver sincronização em nuvem;
- técnicos, ordens de serviço e agendas também ficam somente no IndexedDB deste navegador, sem sincronização entre computadores;
- dados de acesso, fonte ou confiança desconhecidos permanecem como não informados.

## Autor

Brendon Cavalheiro
