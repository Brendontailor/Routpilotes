# RoutePilot

RoutePilot é uma aplicação web instalável para consulta geográfica operacional e planejamento de visitas técnicas.

## Objetivo

O sistema ajuda a localizar um atendimento e compreender rapidamente:

- cidade;
- região operacional;
- bairro ou localidade;
- regiões próximas;
- referências e acessos conhecidos;
- distâncias aproximadas em linha reta.

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
- busca e identificação por coordenadas;
- identificação de região com point-in-polygon;
- consulta de regiões e localidades próximas;
- comparação entre dois locais e comparação múltipla de regiões;
- painel **Entender esta área**;
- consulta **Ver ao redor** com Haversine e raios configuráveis;
- Street View gratuito por URL do Google Maps;
- compartilhamento por deep link;
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

O projeto não exige framework, backend, chave de API ou serviço pago.

## Execução local

Na raiz do projeto, execute:

```bash
python -m http.server 4173
```

Depois abra [http://localhost:4173](http://localhost:4173) no navegador.

O uso por servidor HTTP é recomendado para que o Service Worker, a PWA e os demais recursos do navegador funcionem corretamente. Não use apenas `file://` para validar o projeto.

## Deploy

O RoutePilot pode ser publicado como site estático no Netlify. A raiz de publicação deve conter diretamente `index.html`, `manifest.webmanifest`, `service-worker.js` e as pastas `css/`, `data/`, `js/` e `vendor/`.

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
|-- vendor/
|-- docs/
|-- scripts/
|-- AGENTS.md
|-- README.md
`-- .gitignore
```

## Limitações

- os tiles do OpenStreetMap exigem internet;
- Google Maps e Street View exigem internet;
- alguns limites rurais são contornos operacionais aproximados;
- distâncias calculadas internamente são em linha reta, não rotas rodoviárias;
- informações operacionais cadastradas precisam ser revisadas antes de serem tratadas como validadas;
- as anotações ficam no IndexedDB do navegador e do computador atual enquanto não houver sincronização em nuvem;
- dados de acesso, fonte ou confiança desconhecidos permanecem como não informados.

## Autor

Brendon Cavalheiro
