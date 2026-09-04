# Roteamento local

Dados gerados por `scripts/generate-local-routing-data.mjs` para cálculo de distância por vias dentro do navegador.

- Fonte da malha viária: Overture Maps Foundation, tema `transportation`; fontes declaradas no recorte: OpenStreetMap e TomTom.
- Versão: `2026-08-19.0`.
- Licença declarada no recorte: ODbL 1.0.
- Atribuição: https://docs.overturemaps.org/attribution/

O arquivo `road-network.json` é carregado somente ao calcular uma rota. O catálogo e os 64 fragmentos de endereços locais também são carregados sob demanda. Nenhuma consulta de roteamento ou geocodificação é enviada a terceiros.
