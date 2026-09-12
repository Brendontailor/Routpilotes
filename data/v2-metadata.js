const ACCESS_TYPES=new Set(['urban','rural','highway','mixed','unknown']);
const ACCESS_SURFACES=new Set(['asphalt','paved','unpaved','mixed','unknown']);
const ACCESS_DIFFICULTIES=new Set(['easy','medium','difficult','unknown']);
const DATA_CONFIDENCE_LEVELS=new Set(['high','medium','approximate','unknown']);
const NOTE_TYPES=new Set(['general','access','warning','reference']);

function applyV2Defaults(item) {
  item.aliases=Array.isArray(item.aliases)?item.aliases:[];
  item.access={
    type:ACCESS_TYPES.has(item.access?.type)?item.access.type:'unknown',
    surface:ACCESS_SURFACES.has(item.access?.surface)?item.access.surface:'unknown',
    difficulty:ACCESS_DIFFICULTIES.has(item.access?.difficulty)?item.access.difficulty:'unknown',
    mainAccess:typeof item.access?.mainAccess==='string'?item.access.mainAccess:null
  };
  item.notes=Array.isArray(item.notes)?item.notes.filter(note=>note&&NOTE_TYPES.has(note.type)&&typeof note.text==='string'):[];
  item.dataQuality={
    confidence:DATA_CONFIDENCE_LEVELS.has(item.dataQuality?.confidence)?item.dataQuality.confidence:'unknown',
    source:typeof item.dataQuality?.source==='string'?item.dataQuality.source:null,
    sourceDate:typeof item.dataQuality?.sourceDate==='string'?item.dataQuality.sourceDate:null,
    reviewed:item.dataQuality?.reviewed===true
  };
}

points.forEach(applyV2Defaults);
regions.forEach(applyV2Defaults);

// Boundary names are existing registered data, so they are safe search aliases.
boundaries.features.forEach(feature=>{
  const point=points.find(item=>item.id===feature.properties.pointId);
  const properties=feature.properties,alias=properties.name;
  const cityLabel={'Capao do Leao':'Capão do Leão',Cangucu:'Canguçu'}[properties.city]||properties.city;
  if(!properties.classification)properties.classification=properties.category==='bairro'?'Bairro com contorno oficial':properties.category||'Área cartográfica';
  if(!properties.description){
    properties.description=/IBGE/i.test(properties.source||'')
      ?`${properties.name} é um bairro delimitado pela Malha de Bairros do Censo 2022 do IBGE em ${cityLabel}.`
      :`${properties.name} é uma área cartográfica classificada como ${properties.category||'localidade'} em ${cityLabel}.`;
  }
  if(point){
    point.classification=point.classification||properties.classification;
    point.description=point.description||properties.description;
    point.source=point.source||properties.source;
    point.sourceUrl=point.sourceUrl||properties.sourceUrl;
  }
  if(point&&alias&&alias!==point.name&&!point.aliases.includes(alias))point.aliases.push(alias);
});

const MORRO_REDONDO_OFFICIAL_NAMES=new Set(['acoita cavalo','cerro da buena','reserva','afonso pena','colorado','rincao da caneleira','cachoeira','santo amor','santa bernardina','campestre','sao domingos','sao pedro','capela da buena','palha branca','passo do valdez']);
const MORRO_REDONDO_SOURCE='https://www.morroredondo.rs.gov.br/portal/servicos/1003/dados-gerais/';
const CAPAO_DO_LEAO_OFFICIAL_NAMES=new Set(['centro do capao','hidraulica','passo das pedras','teodosio','cerro do estado','parque fragata','jardim america']);
const CAPAO_DO_LEAO_SOURCE='https://www.capaodoleao.rs.gov.br/dados-gerais/';
const normalizedLocalityName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^colonia\s+/,'').trim();

// Toda localidade recebe uma explicação honesta, mesmo quando ainda não há contorno oficial.
points.filter(item=>item.kind!=='referencia').forEach(item=>{
  if(item.description)return;
  const officialMorroName=item.city==='Morro Redondo'&&MORRO_REDONDO_OFFICIAL_NAMES.has(normalizedLocalityName(item.name));
  const officialCapaoName=item.city==='Capao do Leao'&&CAPAO_DO_LEAO_OFFICIAL_NAMES.has(normalizedLocalityName(item.name));
  if(officialMorroName){
    item.classification='Localidade reconhecida pelo município';
    item.description=`${item.name} consta na relação de localidades publicada pela Prefeitura de Morro Redondo. O marcador é uma referência operacional; não representa um limite oficial.`;
    item.nameSource='Prefeitura Municipal de Morro Redondo';item.nameSourceUrl=MORRO_REDONDO_SOURCE;
    return;
  }
  if(officialCapaoName){
    item.classification='Localidade reconhecida pelo município';
    item.description=`${item.name} consta na relação de bairros e distritos publicada pela Prefeitura de Capão do Leão. O marcador é uma referência operacional; não representa um limite oficial.`;
    item.nameSource='Prefeitura Municipal de Capão do Leão';item.nameSourceUrl=CAPAO_DO_LEAO_SOURCE;
    return;
  }
  const type=item.kind==='estrada'?'eixo viário':item.kind==='centro'?'área central':item.kind==='bairro'?'bairro':'localidade';
  const article=item.kind==='estrada'||item.kind==='bairro'?'um':'uma';
  const usage=item.kind==='estrada'||item.kind==='bairro'?'usado':'usada';
  const cityLabel={'Capao do Leao':'Capão do Leão',Cangucu:'Canguçu'}[item.city]||item.city;
  item.classification=item.classification||`${type[0].toUpperCase()}${type.slice(1)} operacional`;
  item.description=`${item.name} é ${article} ${type} ${usage} na navegação do RoutePilot em ${cityLabel}. O marcador indica a posição de referência; não há contorno oficial verificado associado.`;
});
