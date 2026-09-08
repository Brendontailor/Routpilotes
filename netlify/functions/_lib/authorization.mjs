/* Autorizacao central das funcoes protegidas do RoutePilot. */
import {getUser} from '@netlify/identity';

/** Normaliza a lista de e-mails autorizados configurada no Netlify. */
function allowedEmails(){return new Set(String(process.env.ROUTEPILOT_ALLOWED_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean));}

/** Exige identidade valida e uma autorizacao explicita por e-mail ou papel. */
export async function requireAuthorizedUser(){
  const user=await getUser();
  if(!user){const error=new Error('authentication_required');error.status=401;throw error;}
  const email=String(user.email||'').trim().toLowerCase(),roles=new Set([...(user.roles||[]),user.role].filter(Boolean)),emailAllowed=allowedEmails().has(email),roleAllowed=roles.has('routepilot')||roles.has('admin');
  if(!emailAllowed&&!roleAllowed){const error=new Error('authorization_required');error.status=403;throw error;}
  return {id:String(user.id),email,name:String(user.name||user.userMetadata?.full_name||email),roles:[...roles]};
}

/** Converte falhas de identidade em codigos seguros para a interface. */
export function authorizationError(error){
  if(error?.status===401)return {status:401,body:{error:'authentication_required'}};
  if(error?.status===403)return {status:403,body:{error:'authorization_required'}};
  return null;
}
