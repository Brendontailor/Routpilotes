/* Informa ao navegador somente a identidade e as permissoes da sessao atual. */
import {authorizationError,permissionsForUser,requireAuthenticatedUser} from './_lib/authorization.mjs';
import {json} from './_lib/database.mjs';

export const config={path:'/api/session',rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip','domain']}};

/** Retorna capacidades calculadas no servidor, sem expor configuracoes internas. */
export default async function handler(request){
  if(request.method!=='GET')return json({error:'method_not_allowed'},{status:405});
  try{
    const user=await requireAuthenticatedUser();
    return json({user:{id:user.id,email:user.email,name:user.name},permissions:permissionsForUser(user)});
  }catch(error){
    const auth=authorizationError(error);if(auth)return json(auth.body,{status:auth.status});
    return json({error:'session_unavailable'},{status:500});
  }
}
