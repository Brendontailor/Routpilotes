/* Recurso RoutePilot: configurações globais. */
/* Configurações compartilhadas da aplicação. Alterar valores aqui evita números soltos nos módulos. */
const CONFIGURACAO_MAPA=Object.freeze({
  centroInicial:Object.freeze([-31.62,-52.48]),
  zoomInicial:10,
  zoomLocalidades:12,
  zoomRegiao:14,
  zoomComparacao:15,
  zoomPontoIdentificado:15,
  zoomBairro:16,
  zoomCliqueDetalhado:17,
  zoomNativoOsm:19,
  zoomMaximo:20
});

const CONFIGURACAO_PESQUISA=Object.freeze({
  debounceMs:350,
  limiteResultados:40
});

const CONFIGURACAO_OVERPASS=Object.freeze({
  zoomMinimo:17,
  debounceMs:500,
  cacheTtlMs:12*60*60*1000,
  cacheMaximo:40,
  prefixoCache:'routepilot:osm-addresses:v4:',
  timeoutRequisicaoMs:22000,
  timeoutConsultaSegundos:18,
  tamanhoMaximoResposta:33554432,
  maximoElementos:12000,
  distanciaAssociacaoPredioMetros:24,
  limiteReferenciasConsulta:40,
  limiteReferenciasMapa:24,
  zoomCacheDetalhado:19,
  zoomMaximoChaveCache:20,
  margemConsultaPadrao:.025,
  margemConsultaDetalhada:.04,
  perfisRenderizacao:Object.freeze([
    Object.freeze({zoomMinimo:20,maxLabels:700,collisionPadding:0,maxAreaKm2:1.2,labelScale:'xl'}),
    Object.freeze({zoomMinimo:19,maxLabels:520,collisionPadding:1,maxAreaKm2:1.8,labelScale:'lg'}),
    Object.freeze({zoomMinimo:18,maxLabels:280,collisionPadding:3,maxAreaKm2:3,labelScale:'md'}),
    Object.freeze({zoomMinimo:17,maxLabels:140,collisionPadding:6,maxAreaKm2:5,labelScale:'sm'})
  ]),
  endpoints:Object.freeze([
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ])
});

const CONFIGURACAO_FOCO_ENDERECOS=Object.freeze({
  raioInicialMetros:300,
  raiosDisponiveisMetros:Object.freeze([100,200,300,500]),
  raioMinimoMetros:100,
  raioMaximoMetros:500,
  zoomMinimo:17,
  zoomMaximo:19,
  zoomNumeroVerificado:20,
  zoomReferencia:19
});

const CONFIGURACAO_ENDERECOS_ABERTOS=Object.freeze({
  diretorioTiles:'data/open-address-tiles',
  distanciaDuplicadaMetros:12,
  prioridade:120
});

const CONFIGURACAO_ROTAS_LOCAIS=Object.freeze({
  arquivoMalha:'data/routing/road-network.json',
  arquivoCatalogoRuas:'data/routing/address-streets.json',
  diretorioDados:'data/routing',
  distanciaMaximaAjusteMetros:3000,
  maximoRotasCache:30
});

const CONFIGURACAO_GEOCODIFICACAO=Object.freeze({
  debounceMs:320,
  minimoCaracteres:4,
  maximoSugestoes:5,
  cacheTtlMs:30*60*1000,
  pontuacaoLocalForte:1080,
  pontuacaoExternaForte:900,
  centroPreferencial:Object.freeze([-31.62,-52.48]),
  photon:Object.freeze({
    habilitado:true,
    urlBase:'https://photon.komoot.io',
    idioma:'default',
    timeoutMs:6500,
    pausaAposLimiteMs:2*60*1000,
    limiteResultados:8
  }),
  geoapify:Object.freeze({
    habilitado:true,
    urlBase:'https://api.geoapify.com/v1/geocode',
    apiKey:String(globalThis.ROUTEPILOT_RUNTIME_CONFIG?.geoapifyApiKey||''),
    proxyUrl:String(globalThis.ROUTEPILOT_RUNTIME_CONFIG?.geoapifyProxyUrl||''),
    timeoutMs:6500,
    pausaAposLimiteMs:2*60*1000,
    limiteResultados:8
  })
});
