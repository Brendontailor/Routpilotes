/* Recurso RoutePilot: atualização da cópia de endereços OSM. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ=path.resolve(process.argv[2]||'.');
const ARQUIVO_SAIDA=path.join(RAIZ,'data','osm-address-snapshot.js');
const ENDPOINTS=[
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];
const TIMEOUT_MS=60000;
const TAMANHO_MAXIMO_BLOCO_GRAUS=.06;

const contexto={};
vm.createContext(contexto);
vm.runInContext(fs.readFileSync(path.join(RAIZ,'data','regions.js'),'utf8').replace(/^const /gm,'var '),contexto);

/** Guia: Executa uma etapa auxiliar em atualização da cópia de endereços OSM (`pontoNoPoligono`). */
function pontoNoPoligono(lat,lon,poligono){
  let dentro=false;
  for(let i=0,j=poligono.length-1;i<poligono.length;j=i++){
    const [latI,lonI]=poligono[i],[latJ,lonJ]=poligono[j];
    if(((latI>lat)!==(latJ>lat))&&(lon<(lonJ-lonI)*(lat-latI)/((latJ-latI)||Number.EPSILON)+lonI))dentro=!dentro;
  }
  return dentro;
}

/** Guia: Executa uma etapa auxiliar em atualização da cópia de endereços OSM (`limitesRegiao`). */
function limitesRegiao(regiao){
  const latitudes=regiao.polygon.map(ponto=>ponto[0]);
  const longitudes=regiao.polygon.map(ponto=>ponto[1]);
  return [Math.min(...latitudes),Math.min(...longitudes),Math.max(...latitudes),Math.max(...longitudes)];
}

/** Guia: Executa uma etapa auxiliar em atualização da cópia de endereços OSM (`coordenadasElemento`). */
function coordenadasElemento(elemento){
  if(Number.isFinite(elemento.lat)&&Number.isFinite(elemento.lon))return [elemento.lat,elemento.lon];
  if(Number.isFinite(elemento.center?.lat)&&Number.isFinite(elemento.center?.lon))return [elemento.center.lat,elemento.center.lon];
  return null;
}

/** Guia: Executa uma etapa auxiliar em atualização da cópia de endereços OSM (`dividirLimites`). */
function dividirLimites(limites){
  const [sul,oeste,norte,leste]=limites;
  const linhas=Math.max(1,Math.ceil((norte-sul)/TAMANHO_MAXIMO_BLOCO_GRAUS));
  const colunas=Math.max(1,Math.ceil((leste-oeste)/TAMANHO_MAXIMO_BLOCO_GRAUS));
  const blocos=[];
  for(let linha=0;linha<linhas;linha++)for(let coluna=0;coluna<colunas;coluna++)blocos.push([
    sul+(norte-sul)*linha/linhas,
    oeste+(leste-oeste)*coluna/colunas,
    sul+(norte-sul)*(linha+1)/linhas,
    oeste+(leste-oeste)*(coluna+1)/colunas
  ]);
  return blocos;
}

/** Guia: Executa uma etapa auxiliar em atualização da cópia de endereços OSM (`consultarBloco`). */
async function consultarBloco(limites){
  const bbox=limites.map(valor=>valor.toFixed(7)).join(',');
  const consulta=`[out:json][timeout:45][maxsize:33554432];nwr["addr:housenumber"](${bbox});out tags center qt;`;
  let ultimoErro;
  for(const endpoint of ENDPOINTS){
    const controlador=new AbortController();
    const temporizador=setTimeout(()=>controlador.abort(),TIMEOUT_MS);
    try{
      const resposta=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:consulta}),signal:controlador.signal,headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}});
      if(!resposta.ok)throw new Error(`${endpoint} respondeu ${resposta.status}`);
      const dados=await resposta.json();
      return dados.elements||[];
    }catch(erro){ultimoErro=erro;}
    finally{clearTimeout(temporizador);}
  }
  throw ultimoErro||new Error(`Não foi possível consultar ${bbox}`);
}

/** Guia: Executa uma etapa auxiliar em atualização da cópia de endereços OSM (`consultarRegiao`). */
async function consultarRegiao(regiao){
  const blocos=dividirLimites(limitesRegiao(regiao));
  const recebidos=[];
  for(let inicio=0;inicio<blocos.length;inicio+=2){
    const lote=await Promise.all(blocos.slice(inicio,inicio+2).map(consultarBloco));
    lote.forEach(elementos=>recebidos.push(...elementos));
  }
  const unicos=new Map();
  recebidos.forEach(elemento=>unicos.set(`${elemento.type}/${elemento.id}`,elemento));
  return [...unicos.values()].map(elemento=>({elemento,coordenadas:coordenadasElemento(elemento)}))
    .filter(item=>item.coordenadas&&pontoNoPoligono(item.coordenadas[0],item.coordenadas[1],regiao.polygon));
}

const encontrados=new Map();
for(const regiao of contexto.regions){
  const itens=await consultarRegiao(regiao);
  for(const {elemento,coordenadas} of itens){
    const chave=`${elemento.type}/${elemento.id}`;
    const candidato={elemento,coordenadas,regiao};
    const atual=encontrados.get(chave);
    if(!atual)encontrados.set(chave,candidato);
    else {
      const distanciaAtual=(atual.coordenadas[0]-atual.regiao.center[0])**2+(atual.coordenadas[1]-atual.regiao.center[1])**2;
      const distanciaNova=(coordenadas[0]-regiao.center[0])**2+(coordenadas[1]-regiao.center[1])**2;
      if(distanciaNova<distanciaAtual)encontrados.set(chave,candidato);
    }
  }
  console.log(`${regiao.id}: ${itens.length} endereços encontrados`);
}

const pontos=[...encontrados.values()].map(({elemento,coordenadas,regiao})=>({
  id:`osm_${elemento.type}_${elemento.id}`,
  osmId:`${elemento.type}/${elemento.id}`,
  label:String(elemento.tags?.['addr:housenumber']||'').trim(),
  street:String(elemento.tags?.['addr:street']||''),
  place:String(elemento.tags?.['addr:place']||''),
  lat:coordenadas[0],
  lon:coordenadas[1],
  city:regiao.city,
  region:regiao.id
})).filter(item=>item.label).sort((a,b)=>a.region.localeCompare(b.region)||a.street.localeCompare(b.street,'pt-BR')||a.label.localeCompare(b.label,'pt-BR',{numeric:true}));

const cabecalho='/* Snapshot de endereços públicos do OpenStreetMap. Gerado pelo script de atualização; não editar manualmente. */\n';
const conteudo=`const osmAddressSnapshot=${JSON.stringify({generatedAt:new Date().toISOString(),source:'OpenStreetMap',license:'ODbL',points:pontos})};\n`;
fs.writeFileSync(ARQUIVO_SAIDA,cabecalho+conteudo,'utf8');
console.log(`Total único: ${pontos.length} endereços em ${ARQUIVO_SAIDA}`);
