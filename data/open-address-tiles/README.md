# Endereços abertos

Os arquivos desta pasta são gerados por `scripts/generate-open-address-tiles.mjs`.

- Fonte: Overture Maps Foundation, tema `addresses`.
- Fonte original no Brasil: IBGE, distribuída por AddressForAll.
- Versão consultada: `2026-08-19.0`.
- Licença informada para o Brasil: CC0.
- Atribuição e termos: https://docs.overturemaps.org/attribution/

Cada JSON representa uma célula de 0,01 grau e é carregado somente quando cruza o mapa visível. Os campos compactos são, nesta ordem: ID interno, latitude, longitude, número, rua e ID da região RoutePilot.

Registros sem número, fora dos contornos operacionais ou duplicados não são publicados.
