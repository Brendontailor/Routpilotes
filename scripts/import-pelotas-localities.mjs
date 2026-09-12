import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const SERVICE_URL='https://services7.arcgis.com/eZCVR8OCOrxMQJ75/arcgis/rest/services/micro_regioes/FeatureServer/0';
const SOURCE_URL='https://www.arcgis.com/home/item.html?id=0eb6323abdd74aa3ad91012627a84be1';
const OUTPUT_PATH=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data/pelotas-localities.js');
const MACRO_COLORS={AREAL:'#dc6b42',BARRAGEM:'#7a769c',CENTRO:'#178da6',FRAGATA:'#4b78a8',LARANJAL:'#258c76','SÃO GONÇALO':'#a84d7a','TRÊS VENDAS':'#6b8d3d'};
const LEGACY_IDS={
  BARONESA:'pelotas_baronesa','BALNEÁRIO DOS PRAZERES':'pelotas_balneario_dos_prazeres_barro_duro',
  'BOM JESUS':'pelotas_bom_jesus',DUNAS:'pelotas_dunas','FÁTIMA':'pelotas_nossa_senhora_de_fatima',
  'GETÚLIO VARGAS':'pelotas_getulio_vargas','JARDIM EUROPA':'pelotas_jardim_europa',NAVEGANTES:'pelotas_navegantes',
  PESTANO:'pelotas_pestano',PORTO:'pelotas_porto','SANTO ANTÔNIO':'pelotas_santo_antonio',
  'SIMÕES LOPES':'pelotas_simoes_lopes_gotuzzo',VALVERDE:'pelotas_valverde','VILA PRINCESA':'pelotas_vila_princesa'
};

/** Cria um identificador estavel a partir do codigo oficial da micro-regiao. */
function localityId(attributes){return LEGACY_IDS[attributes.NOMEMICRO]||`pelotas_localidade_${attributes.CODMICRO.toLowerCase().replace(/[^a-z0-9]+/g,'_')}`;}

/** Converte os aneis Esri para GeoJSON sem alterar os vertices publicados. */
function polygonGeometry(rings){return {type:'Polygon',coordinates:rings};}

/** Busca a camada municipal com geometria e centroide em WGS84. */
async function loadOfficialFeatures(){
  const params=new URLSearchParams({where:'1=1',outFields:'FID,CODMICRO,NOMEMACRO,NOMEMICRO,LABEL',returnGeometry:'true',returnCentroid:'true',outSR:'4326',f:'json'});
  const response=await fetch(`${SERVICE_URL}/query?${params}`);
  if(!response.ok)throw new Error(`Pelotas ArcGIS respondeu ${response.status}`);
  const payload=await response.json();
  if(payload.error||!Array.isArray(payload.features))throw new Error(payload.error?.message||'Resposta geografica invalida');
  return payload.features;
}

/** Monta o arquivo estatico consumido pelo PWA, sem consulta remota em tempo de uso. */
function buildOutput(features){
  const namedFeatures=features.filter(feature=>feature.attributes.LABEL?.trim()&&feature.attributes.NOMEMICRO!=='VAZIO URBANO');
  const records=namedFeatures.map(({attributes,geometry,centroid})=>{
    const pointId=localityId(attributes),region=attributes.NOMEMACRO==='LARANJAL'?'laranjal':'pelotas_urbana';
    const description=`Micro-região urbana oficial de Pelotas, integrante da macrorregião municipal ${attributes.NOMEMACRO}. Código municipal ${attributes.CODMICRO}.`;
    return {type:'Feature',geometry:polygonGeometry(geometry.rings),properties:{id:`pelotas-micro-${attributes.CODMICRO.toLowerCase()}`,officialCode:attributes.CODMICRO,name:attributes.NOMEMICRO,macroRegion:attributes.NOMEMACRO,city:'Pelotas',region,pointId,point:[centroid.y,centroid.x],category:'localidade urbana oficial',classification:'Micro-região urbana oficial',description,source:'Prefeitura Municipal de Pelotas',sourceUrl:SOURCE_URL,color:MACRO_COLORS[attributes.NOMEMACRO]||'#087f96'}};
  });
  const json=JSON.stringify({type:'FeatureCollection',features:records});
  return `/* Localidades oficiais de Pelotas. Gerado por scripts/import-pelotas-localities.mjs. */\nconst pelotasOfficialLocalities=${json};\n`+
    `const pelotasOfficialSource=${JSON.stringify({name:'Prefeitura Municipal de Pelotas',url:SOURCE_URL,serviceUrl:SERVICE_URL,importedAt:new Date().toISOString(),namedLocalities:records.length,excludedUrbanVoids:features.length-records.length})};\n`+
    `for(let index=points.length-1;index>=0;index--){if(points[index].city==='Pelotas'&&['pelotas_urbana','laranjal'].includes(points[index].region)&&points[index].kind==='bairro')points.splice(index,1);}\n`+
    `for(let index=boundaries.features.length-1;index>=0;index--){const item=boundaries.features[index].properties;if(item.city==='Pelotas'&&item.category==='bairro')boundaries.features.splice(index,1);}\n`+
    `pelotasOfficialLocalities.features.forEach(feature=>{const item=feature.properties;boundaries.features.push(feature);points.push({id:item.pointId,name:item.name,aliases:[item.officialCode,item.macroRegion],city:item.city,region:item.region,lat:item.point[0],lon:item.point[1],roads:'',kind:'bairro',boundaryId:item.id,classification:item.classification,description:item.description,officialCode:item.officialCode,macroRegion:item.macroRegion,source:item.source,sourceUrl:item.sourceUrl});});\n`+
    `const validPointIds=new Set(points.map(point=>point.id));points.forEach(point=>{if(Array.isArray(point.nearby))point.nearby=point.nearby.filter(pointId=>validPointIds.has(pointId));});\n`+
    `boundaries.features.forEach(feature=>{if(feature.properties.pointId&&!validPointIds.has(feature.properties.pointId))feature.properties.pointId=null;});\n`;
}

const features=await loadOfficialFeatures();
await writeFile(OUTPUT_PATH,buildOutput(features),'utf8');
console.log(`Localidades oficiais de Pelotas: ${features.filter(feature=>feature.attributes.LABEL?.trim()&&feature.attributes.NOMEMICRO!=='VAZIO URBANO').length} registros em ${OUTPUT_PATH}`);
