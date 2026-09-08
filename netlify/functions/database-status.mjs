/* Diagnostico seguro: cria o esquema e confirma a conexao sem exibir segredos. */
import {authorizationError,requireAuthorizedUser} from './_lib/authorization.mjs';
import {ensureSchema,getDatabase,json} from './_lib/database.mjs';

export const config={
  path:'/api/database-status',
  rateLimit:{windowLimit:30,windowSize:60,aggregateBy:['ip','domain']}
};

/** Confirma a conexao e informa apenas totais nao sensiveis. */
export default async function handler(request){
  if(request.method!=='GET')return json({error:'method_not_allowed'},{status:405});
  try{
    await requireAuthorizedUser();
    const sql=getDatabase();
    await ensureSchema(sql);
    const rows=await sql`SELECT collection,COUNT(*)::int AS count FROM routepilot_records WHERE is_deleted=FALSE GROUP BY collection ORDER BY collection`;
    return json({ok:true,database:'connected',collections:Object.fromEntries(rows.map(row=>[row.collection,row.count]))});
  }catch(error){
    const auth=authorizationError(error);if(auth)return json(auth.body,{status:auth.status});
    if(error?.code==='DATABASE_NOT_CONFIGURED')return json({ok:false,error:'database_not_configured'},{status:503});
    console.error('RoutePilot database health check failed',error?.message||error);
    return json({ok:false,error:'database_unavailable'},{status:500});
  }
}
