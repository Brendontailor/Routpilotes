# RoutePilot State

Versao atual: V2 oficial - navegacao desktop e painel contextual

Ultima atualizacao: 2026-09-04

## Concluido

- Aplicacao estatica modularizada e validada.
- IDs unicos para 105 pontos.
- Caso Cascata separado entre Pelotas e Morro Redondo.
- Relacoes de proximidade migradas para IDs quando resolviveis.
- Point-in-polygon aplicado ao filtro regional de referencias.
- Leaflet 1.9.4 local.
- Busca, navegacao, comparacao, Street View, impressao e PWA preservados.
- Pasta e ZIP V1 refatorados validados para Netlify.
- Contexto permanente da V2 criado.
- Campos opcionais V2 aplicados a 105 locais e 11 regioes.
- Aliases existentes nos contornos integrados a busca sem criar nomes novos.
- Validador reutilizavel ampliado com erros, avisos e informacoes.
- Fase 1 validada com zero erros, 15 avisos e 420 informacoes.
- Identificacao de ponto e busca por coordenadas concluidas.
- Point-in-polygon, localidade e referencia mais proximas integrados.
- Painel Entender esta area concluido com campos desconhecidos exibidos sem suposicao.
- Ver ao redor concluido com raios 2, 5, 10, 20 km e personalizado.
- Camada local de anotacoes operacionais concluida com estados pending, validated e rejected.
- Validacao de anotacoes nao altera dados estruturais do mapa.
- Deep links por cidade, regiao, local e coordenadas concluidos.
- Compartilhamento por clipboard com alternativa manual concluido.
- Revisao de dados integrada ao menu Ferramentas.
- Service worker atualizado para V5.
- Pasta limpa e ZIP V2 gerados e validados para Netlify.
- Codigo-fonte V2 promovido para a raiz oficial do repositorio.
- README profissional e `.gitignore` adicionados.
- Ferramentas agora oferece `Anotar ponto`, abrindo o formulario apos selecionar uma coordenada.
- Git local inicializado na branch `main`.
- Repositorio remoto oficial publicado em `https://github.com/Brendontailor/Routpilotes`.
- Shell desktop reorganizado com barra de ferramentas compacta, breadcrumb e painel contextual unificado.
- Camadas movidas para popover da barra de ferramentas; estados ativos e Escape centralizados no shell.
- Acoes de regiao e localidade posicionadas antes de listas extensas de bairros e referencias.
- Camada de detalhes de enderecamento adicionada: numeros de casas sobre as edificacoes/pontos OSM em zoom 17+ e identificacao visual de blocos quando o OpenStreetMap possui `addr:block`, nome `Bloco ...` ou `ref` de edificio residencial.
- A nova camada consulta Overpass somente em zoom alto, com atraso apos movimento do mapa, e nao inventa numeros ou blocos ausentes na fonte.

## Em desenvolvimento

- Nenhuma mudanca funcional adicional aberta nesta entrega.

## Proximas etapas

- Revisar futuramente os dados ainda desconhecidos apenas com fontes confirmadas.
- Considerar sincronizacao de anotacoes somente quando houver backend aprovado.

## Problemas conhecidos

- Nenhum erro JavaScript conhecido na V2 validada.
- Distancias atuais sao em linha reta.
- Tiles OSM, Google Maps e Street View dependem de internet.
- Numeros e blocos dependem da cobertura e disponibilidade do OpenStreetMap/Overpass; ausencias na fonte permanecem sem rotulo.

## Dados pendentes

- 15 proximidades permanecem apenas informativas.
- A maioria dos locais ainda nao possui classificacao confirmada de acesso, fonte, confianca ou revisao.
- Dados desconhecidos devem permanecer `unknown`, `null` ou `[]`.

## Ultimos testes

- Sintaxe JavaScript aprovada.
- 29 referencias do service worker encontradas.
- Manifest valido.
- Zero IDs duplicados.
- Zero nearby IDs inexistentes.
- Cascata Pelotas e Cascata Morro Redondo validadas com IDs independentes.
- Fluxos existentes e console sem erros validados antes do inicio da V2.
- Busca por coordenadas, identificacao, Entender esta area, raio de 5 km e Esc validados no navegador.
- Anotacao pendente, tela de revisao, validacao e reapresentacao como conhecimento confiavel validadas no navegador.
- Deep link por coordenada e pelos dois IDs independentes de Cascata validados no navegador.
- Compartilhamento por clipboard e Revisar dados validados no navegador.
- Validador final executado na fonte, na pasta de deploy e no ZIP extraido: zero falhas.
- ZIP com 38 entradas, `index.html` na raiz e sem pasta envolvente.
- Estrutura oficial na raiz validada com zero falhas e sem padroes de segredo encontrados.
- Fluxo Ferramentas -> Anotar ponto -> clique no mapa -> formulario pendente validado no navegador.
- Cascata Pelotas, Cascata Morro Redondo e deep link por coordenada revalidados; console sem erros.
- Desktop validado em 1366x768 e 1600x1000; busca, cidade, regiao, localidade, breadcrumb, painel contextual, barra, Camadas, ferramentas e Escape verificados.
- Identificar ponto, coordenadas, anotacoes pending/validated/rejected, Entender esta area, Ver ao redor, Comparar, Street View e Google Maps validados no navegador.
- Camada de numeros desligada e religada pelo popover Camadas; os rotulos foram removidos e restaurados corretamente.
- Progressao por zoom validada: zero rotulos em zoom 16 e exibicao a partir do zoom 17.
- Fallback entre endpoints e falha total do Overpass simulados; recuperacao pelo endpoint secundario e tratamento sem quebra confirmados.
- Movimentacao rapida do mapa validada com cancelamento das consultas anteriores e renderizacao apenas da area final.
- Inspetor tecnico de edificios validado com OSM ID, coordenadas, centroide, tags, GeoJSON e botoes de copia.
- Layout revalidado em 1366x768, 1600x1000 e 390x844, sem sobreposicao entre zoom, barra, tecnico e atribuicao.
- Console do navegador sem erros JavaScript; permanecem somente os 15 avisos informativos ja documentados.

## Cache/service worker atual

- `routepilot-shell-v11`
- Network-first para HTML e arquivos da mesma origem.
- Caches antigos removidos no evento `activate`.

## Publicacao

- Netlify monitora o repositorio Git oficial; esta entrega nao gera ZIP.

## Git

- Repositorio local conectado ao GitHub.
- Branch: `main`.
- Conta: `Brendontailor`.
- Repositorio: `Brendontailor/Routpilotes`.
- Origin: `https://github.com/Brendontailor/Routpilotes.git`.
- ZIPs, `outputs/`, `work/` e arquivos temporarios permanecem fora do versionamento.
- Commit inicial criado: `Prepare RoutePilot V2 with validated map annotations`.
- Branch local `main` acompanha `origin/main`.
- Entrega atual consolidada na branch `main` para publicacao automatica pelo Netlify.

## 2026-09-04 — Camada global de números de imóveis e blocos

- A camada de detalhes OSM foi ampliada para funcionar de forma independente de cidade em zoom 17+.
- Foram adicionados fallback de endpoints Overpass, cache temporário em memória/localStorage, debounce, deduplicação, associação de nodes de endereço a footprints de edifícios e controle básico de colisão.
- A identificação de blocos continua conservadora: nenhuma numeração é inferida sem tags/fonte confiável.
- A COAB Duque (Pelotas/RS) foi registrada apenas como área prioritária de validação em `data/priority-areas.js`, com centro e link de referência fornecidos pelo usuário; não foi criado perímetro nem número de bloco sem evidência.
- Handoff detalhado para Codex em `docs/CODEX_MAPS_HANDOFF.md`.


## Melhorias de mapa — v10 (handoff para Codex)

- A camada `Números de imóveis e blocos` é global e independente de cidade. Em zoom 17+, consulta OpenStreetMap/Overpass pelo `bbox` visível e exibe `addr:housenumber` sobre a edificação quando possível.
- Endereços cadastrados como nós são associados à edificação que os contém ou, como fallback, ao prédio mais próximo em até 24 m.
- Blocos só recebem rótulo quando tags OSM explícitas sustentam a identificação; não numerar blocos por suposição.
- A COAB Duque (Pelotas/RS) é área prioritária de validação, com referência aproximada em `-31.739243353752904, -52.38847121655026`.
- O controle de zoom foi movido para o canto inferior direito e ampliado para uso mais confortável em desktop e celular, evitando conflito com a barra lateral de ferramentas.
- Cache do Service Worker atualizado para `routepilot-shell-v10`.

### Próximos passos sugeridos ao Codex

1. Validar visualmente a COAB Duque e outros bairros em zoom 17–19.
2. Confirmar limites/rate limits do Overpass em áreas densas; manter debounce, cache e fallback entre endpoints.
3. Se houver uma fonte validada para blocos da COAB Duque, adicionar GeoJSON manual somente para identificações comprovadas.
4. Testar os rótulos em cidades diferentes, especialmente onde o OSM tem endereço em nó separado do polígono da edificação.
5. Não transformar a camada em uma lista fixa de municípios: ela deve continuar funcionando em qualquer cidade com cobertura OSM.

## 2026-09-04 — Fechamento da camada global de enderecamento

- `Numeros de imoveis e blocos (OSM - zoom 17+)` permanece como opcao marcada dentro de Camadas e pode ser desligada sem afetar as demais camadas.
- A consulta usa apenas o `bbox` visivel, tres endpoints publicos atuais, timeout, fallback, cancelamento, debounce, limite de area/resposta e cache temporario com limpeza.
- Rotulos variam por zoom e passam por deduplicacao e controle de colisao; enderecos em nodes sao associados ao poligono que os contem ou ao edificio mais proximo em ate 24 m.
- Blocos sao reconhecidos somente por tags explicitas, inclusive formas `Bloco X` e `BL X`; nenhuma sequencia e inferida.
- O modo tecnico fica recolhido em Camadas e permite inspecionar edifícios sem poluir o uso normal.
- Na coordenada prioritaria `-31.739243353752904, -52.38847121655026`, o OSM retornou edificacoes e os enderecos reais 488 e 756, mas nenhuma tag de bloco.
- O ponto chamado `COHADUQUE` no KML de referencia fica aproximadamente em `-31.7642812, -52.3638874`, diferente da coordenada prioritaria. O OSM nao retornou footprints de edificios nessa segunda area durante a validacao; por isso nenhum bloco foi criado manualmente.
- Uma area residencial de Porto Alegre foi usada como validacao fora das cidades cadastradas, confirmando que a camada e global.
- Corrigida a grade responsiva que comprimia o mapa em telas de ate 900 px.
