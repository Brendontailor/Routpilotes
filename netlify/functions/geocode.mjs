/* Recurso RoutePilot: proxy opcional que impede a exposicao da chave Geoapify. */
const OPERATIONS=new Set(['search','autocomplete','reverse']);
const ALLOWED_PARAMS=new Set(['text','lat','lon','format','lang','limit','filter','bias']);

/** Responde em JSON com cabecalhos consistentes e sem revelar detalhes internos. */
function json(statusCode,body){
  return {
    statusCode,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
    body:JSON.stringify(body)
  };
}

/** Encaminha somente parametros geograficos permitidos para o Geoapify. */
export async function handler(event){
  if(event.httpMethod!=='GET')return json(405,{error:'method_not_allowed'});
  const apiKey=process.env.GEOAPIFY_API_KEY;
  if(!apiKey)return json(503,{error:'provider_not_configured'});

  const operation=String(event.queryStringParameters?.operation||'');
  if(!OPERATIONS.has(operation))return json(400,{error:'invalid_operation'});

  const target=new URL(`https://api.geoapify.com/v1/geocode/${operation}`);
  for(const [key,value] of Object.entries(event.queryStringParameters||{})){
    if(ALLOWED_PARAMS.has(key)&&value)target.searchParams.set(key,String(value).slice(0,500));
  }
  target.searchParams.set('apiKey',apiKey);

  try{
    const response=await fetch(target,{headers:{accept:'application/json'}});
    const body=await response.text();
    return {
      statusCode:response.status,
      headers:{'content-type':response.headers.get('content-type')||'application/json; charset=utf-8','cache-control':'no-store'},
      body
    };
  }catch(error){
    return json(502,{error:'provider_unavailable'});
  }
}
