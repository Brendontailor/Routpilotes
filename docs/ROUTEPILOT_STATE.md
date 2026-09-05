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

- `routepilot-shell-v14`
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

## 2026-09-04 — Foco de enderecos e compartilhamento de pontos

- A busca por `COAB Duque` abre o foco de enderecos com raio de 300 m, ajustavel para 100, 200, 300 ou 500 m.
- Foram incorporados 36 marcadores numerados do KML fornecido pelo usuario: 21 numeros de endereco e 15 marcadores de bloco, preservando coordenadas e identificadores internos independentes.
- O centro de foco da COAB Duque e a media calculada dos 36 marcadores; nenhuma geometria ou numeracao foi inventada.
- A consulta combina os marcadores verificados com numeros, blocos e referencias nomeadas disponiveis no OpenStreetMap/Overpass.
- Clique em um ponto livre do mapa identifica a coordenada e oferece `Ver numeros no raio`; em zoom 17+, o mesmo vale sobre contornos de regiao e bairro.
- Clique direito abre um menu no mapa para focar numeros, compartilhar a localizacao ou copiar somente as coordenadas.
- O compartilhamento inclui coordenadas, regiao operacional, ate tres localidades ou referencias proximas quando existirem e um deep link do RoutePilot.
- No desktop, o texto e copiado para a area de transferencia; em dispositivos de toque com Web Share, o seletor nativo pode ser usado.
- Cache do Service Worker atualizado para `routepilot-shell-v13`.

## 2026-09-04 — Organização interna para desktop/web

- Configurações de mapa, pesquisa, Overpass, cache e foco de endereços foram centralizadas em `js/config.js`.
- Funções internas do mapa, pesquisa e Overpass receberam nomes mais claros em português, sem traduzir APIs ou tags externas.
- A função espacial sem uso `spatialCell` foi removida.
- O clique em um ponto agora mantém o zoom atual quando a tela já está aproximada; em visão distante, aproxima até o mínimo configurado.
- O timeout por endpoint Overpass passou para 22 segundos, pois uma instância pública válida pode responder acima de 15 segundos.
- Em falha dos endpoints, a última resposta local do mesmo trecho pode ser exibida como cache antigo.
- `README.md` ganhou um resumo da estrutura e `docs/GUIA-DO-CODIGO.md` documenta a manutenção do projeto.
- O trabalho desta etapa considera somente desktop/web; não foram feitas otimizações específicas para mobile.
- Cache do Service Worker atualizado para `routepilot-shell-v14`.

## 2026-09-04 — Base local de endereços e revisão da COAB Duque

- Foi gerada em `data/osm-address-snapshot.js` uma base local com 1.792 números disponíveis no OpenStreetMap, limitada aos contornos operacionais já cadastrados.
- A base local é exibida imediatamente e permanece disponível quando os endpoints públicos do Overpass estão lentos ou indisponíveis.
- `scripts/update-osm-address-snapshot.mjs` permite atualizar essa base sem inventar números ou coordenadas.
- A fonte KML da COAB Duque foi revisada e passou a totalizar 43 pontos verificados: 15 blocos e 28 números.
- O número 331 do conjunto `728-7`, nas coordenadas `-31.763328, -52.362457`, foi incluído com ID interno próprio.
- Também foram recuperados da mesma série os números 270, 290, 341, 350, 641 e 641A, que não tinham o prefixo `COHADUQUE` no nome do KML.
- O painel de foco agora separa blocos de números e ordena cada lista do menor para o maior.

## 2026-09-04 — Identificação de ponto no primeiro clique

- O modo `Identificar ponto` agora captura o clique antes das camadas do Leaflet.
- Números de região, rótulos de bairros, pontos e ícones de referência não impedem mais a marcação da coordenada no primeiro clique.
- Controles, botões, links e popups do mapa continuam protegidos contra marcações acidentais.
- Cache do Service Worker atualizado para `routepilot-shell-v15`.

## 2026-09-04 — Endereços abertos por células geográficas

- Foram integrados 122.919 números da versão `2026-08-19.0` do tema `addresses` da Overture Maps.
- Para o Brasil, a fonte declarada é IBGE via AddressForAll, com licença CC0 conforme a página oficial de atribuição da Overture.
- Os dados foram filtrados pelos contornos operacionais atuais e divididos em 850 células de 0,01 grau.
- A aplicação carrega somente as células que cruzam o `bbox` visível em zoom 17 ou superior e mantém cada requisição em cache para não repetir downloads na sessão.
- O Service Worker guarda as células já acessadas para reutilização posterior e não as inclui em massa no app shell.
- Pontos distantes deixam de ser renderizados; números próximos e repetidos passam por deduplicação e controle de colisão.
- Quando o Overpass fornece o polígono da edificação, o número aberto é centralizado nesse contorno.
- Street View continua apenas como referência manual, sem extração automática de números.
- Cache do Service Worker atualizado para `routepilot-shell-v16`.

## 2026-09-04 — Comparação local por estradas

- A comparação de dois locais agora aceita rua, número e cidade usando os 122.919 endereços já integrados.
- A malha viária estática foi gerada do tema `transportation` da Overture Maps, versão `2026-08-19.0`, com fontes declaradas OpenStreetMap e TomTom sob ODbL 1.0.
- O grafo local possui 23.632 trechos de origem, 166.307 nós e 173.611 conexões.
- O cálculo de menor caminho ocorre no navegador e não envia endereços ou coordenadas a serviços de geocodificação ou roteamento.
- O catálogo de 2.416 ruas e 64 fragmentos de endereços é carregado sob demanda; a malha de 6,7 MiB só é carregada ao calcular a primeira rota.
- Sentidos de circulação explícitos são respeitados. Restrições complexas de conversão e condições temporárias continuam sendo uma limitação e exigem conferência operacional.
- Em falha ou falta de conexão dentro da malha, o sistema informa a contingência e usa distância em linha reta.
- Fluxo validado online e offline entre dois endereços da Avenida Duque de Caxias e Rua Voluntários da Pátria, com 3,3 km pela malha local e traçado no mapa.
- Cache do Service Worker atualizado para `routepilot-shell-v17`.

## 2026-09-04 — Comentários didáticos no código

- Os módulos próprios em `js/` e os scripts de manutenção receberam cabeçalhos que identificam seus recursos.
- Funções nomeadas receberam comentários curtos sobre sua responsabilidade, preservando explicações específicas já existentes.
- Eventos anônimos foram documentados por blocos para manter a leitura clara sem poluir cada linha.
- Bibliotecas de `vendor/` e dados gerados não foram alterados.
- Cache do Service Worker atualizado para `routepilot-shell-v18`.

## 2026-09-05 — Comparação dinâmica e planejador de rota

- A comparação de locais no desktop passou a aceitar de 2 a 24 bairros, regiões, localidades ou endereços locais, com matriz de proximidade em cache.
- Foi adicionado um planejador desktop com origem separada, até 24 atendimentos, matriz rodoviária local, fallback identificado em linha reta e camada própria no mapa.
- A sequência recomendada usa vizinho mais próximo e melhoria 2-opt; o usuário pode arrastar cartões, recalcular a ordem manual, restaurar a recomendação e desfazer uma alteração.
- Não existem níveis automáticos de prioridade. O primeiro item da lista é o primeiro atendimento; `Posição fixa` apenas impede que a reotimização mova aquele item.
- O compartilhamento foi centralizado em mensagens rápida, detalhada ou somente localização, contendo apenas dados geográficos e até três referências úteis.
- O fluxo mobile existente de comparação entre dois locais foi preservado e o planejador novo permanece exclusivo do desktop.
- Validação em 1366x768, 1600x900 e 390x844 confirmou comparação, rota de 62,3 km pela malha local, compartilhamento, Esc e ausência de estouro horizontal.
- Corrigida a perda do estado da comparação ao adicionar ou remover o terceiro local em diante.
- Cache do Service Worker atualizado para `routepilot-shell-v19`.

## 2026-09-05 — Ordens de serviço e agenda diária desktop

- Foram adicionadas as áreas desktop `Criar rota` e `Agenda`, sem alterar o fluxo mobile existente.
- O cadastro mantém compatibilidade com números de OS antigos e usa nome do cliente nos novos atendimentos, além de serviço, localização, turno, restrição de horário, técnico obrigatório, bloqueio, posição fixa, prioridade e observação operacional.
- A capacidade por turno usa carga normalizada e nunca ultrapassa o limite silenciosamente; OS sem encaixe permanecem não alocadas com motivo explícito.
- A distribuição escolhe técnico e turno, reaproveita a matriz rodoviária local e otimiza a sequência de cada rota com vizinho mais próximo e 2-opt quando horários e posições permitem.
- A cidade-base do técnico é somente uma preferência. Atendimentos em outra cidade continuam permitidos e recebem um lembrete não bloqueante com técnico, base e destino.
- A equipe inicial possui 11 técnicos: Wendell e Moises com base em Morro Redondo; Pablo e Vagner em Monte Bonito; os demais em Pelotas. Bruno de Lima não faz parte do cadastro padrão.
- Técnicos, OS e agendas são persistidos no IndexedDB; cadastros existentes não são sobrescritos pelos padrões.
- Dias já programados oferecem prévia para reotimizar ou preservar a agenda e encaixar apenas novas OS.
- Cache do Service Worker atualizado para `routepilot-shell-v21`.

## 2026-09-05 — Busca tolerante, turno flexível e filtros da Agenda

- O cadastro desktop de visitas passou a aceitar busca incompleta, sem acento, abreviada, fora de ordem e com pequenos erros de digitação.
- Novos atendimentos identificam o cliente por nome em um campo separado do ID interno; registros antigos com número de OS continuam compatíveis.
- Sugestões locais usam debounce de 320 ms, cache por consulta e token para impedir que respostas antigas substituam pesquisas novas.
- O melhor candidato é exibido no mapa operacional, mas a OS só pode ser salva após confirmação explícita; pontos aproximados podem ser ajustados manualmente.
- A OS preserva texto pesquisado, endereço interpretado, coordenadas, cidade, localidade, fonte e estado de confirmação.
- `Qualquer` é o turno padrão e o scheduler escolhe exatamente um turno compatível, respeitando capacidade e restrições de horário.
- A Agenda recebeu filtros visuais persistentes por ID de técnico, com seleção de colunas, `Sem colaborador`, filtros nomeados e filtro padrão.
- Alterar filtros não recalcula rotas nem modifica OS, técnicos ou agenda.
- Os novos recursos continuam exclusivos do desktop; nenhuma interface ou breakpoint mobile foi alterado.
- Cache do Service Worker atualizado para `routepilot-shell-v22`.

## 2026-09-05 — Busca de endereços em toda a base local

- O catálogo local de 2.416 vias passou a registrar as cidades e regiões onde cada via possui endereços.
- A busca de atendimentos consulta todo o catálogo leve, tolera pequenos erros e usa cidade/região para distinguir nomes semelhantes.
- O número da casa não reduz a correspondência do nome da via; somente os fragmentos dos melhores candidatos são carregados, em paralelo e com cache.
- Resultados com número exato recebem preferência. Quando o número não existe na base, o sistema mantém a indicação de localização aproximada e exige confirmação no mapa.
- Cada candidato pode ser conferido manualmente no Google Maps por um link de pesquisa; o RoutePilot não consulta nem copia a base do Google.
- A cobertura permanece limitada aos 122.919 endereços abertos já integrados nas cinco cidades atendidas; nenhum endereço ou coordenada foi inventado.
- Cache do Service Worker atualizado para `routepilot-shell-v23`.

## 2026-09-05 — Geocodificação híbrida local, Photon e Geoapify

- A busca do cadastro de atendimento passou a usar providers independentes e um modelo interno único.
- A base local continua sendo consultada primeiro; resultado local forte evita chamadas externas.
- Photon amplia buscas fracas ou sem resultado, com bias e limite para a área operacional.
- Geoapify é um complemento opcional e só é consultado quando Photon não resolve bem ou o usuário pede outras opções.
- A chave Geoapify fica em `GEOAPIFY_API_KEY` no Netlify e é lida somente pela função `netlify/functions/geocode.mjs`; não existe segredo versionado ou enviado ao navegador.
- Cache por consulta, contexto e provider evita chamadas repetidas; requisições antigas são canceladas ou descartadas.
- Resultados passam por ranking de texto, número, cidade, região atendida, completude e origem, além de deduplicação por endereço e proximidade.
- A comparação fuzzy exige igualdade entre tokens numéricos, evitando confundir ruas ou casas como `28` e `284`; nomes de rua numéricos continuam sendo separados do número do imóvel.
- Seleção manual e coordenadas continuam válidas mesmo se o reverse geocoding falhar; ruas sem número confirmado podem ser aceitas como aproximadas.
- A OS preserva texto pesquisado, endereço formatado, coordenadas, cidade, localidade, fonte e confirmação para reutilização pela agenda e pelo roteirizador.
- Cache do Service Worker atualizado para `routepilot-shell-v24`.

## 2026-09-05 — Preenchimento pelo autocomplete

- Ao clicar em uma sugestão do cadastro de atendimento, o endereço formatado escolhido substitui o texto digitado no campo.
- A sugestão continua sendo apenas uma prévia até o usuário confirmar a localização.
- O mapa da distribuição detecta quando a tela recria seu contêiner e remonta o Leaflet, evitando o painel vazio após cadastrar, gerar ou reorganizar atendimentos.
- Cache do Service Worker atualizado para `routepilot-shell-v25`.
