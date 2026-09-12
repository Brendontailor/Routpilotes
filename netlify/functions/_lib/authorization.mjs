/* Autorizacao central das funcoes protegidas do RoutePilot. */
import {getUser} from '@netlify/identity';

const DEFAULT_MAP_ADMIN_EMAIL='brendontailor040@gmail.com';

/** Normaliza a lista de e-mails autorizados configurada no Netlify. */
function allowedEmails(){return new Set(String(process.env.ROUTEPILOT_ALLOWED_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean));}

/** Normaliza a lista restrita de administradores geograficos. */
function mapAdminEmails(){return new Set(String(process.env.ROUTEPILOT_MAP_ADMIN_EMAILS||DEFAULT_MAP_ADMIN_EMAIL).split(',').map(value=>value.trim().toLowerCase()).filter(Boolean));}

/** Exige apenas uma sessao valida do Netlify Identity. */
export async function requireAuthenticatedUser(){
  const user=await getUser();
  if(!user){const error=new Error('authentication_required');error.status=401;throw error;}
  return {id:String(user.id),email:String(user.email||'').trim().toLowerCase(),name:String(user.name||user.userMetadata?.full_name||user.email||'Usuario'),roles:[...(user.roles||[]),user.role].filter(Boolean)};
}

/** Calcula permissoes no servidor a partir da identidade autenticada. */
export function permissionsForUser(user){
  const roles=new Set(user.roles||[]),mapAdministrator=mapAdminEmails().has(user.email)||roles.has('map-admin')||roles.has('admin');
  const sharedOperator=mapAdministrator||allowedEmails().has(user.email)||roles.has('routepilot');
  return {canUseSharedOperations:sharedOperator,canManageSharedMap:mapAdministrator,canReviewMapRequests:mapAdministrator};
}

/** Exige identidade valida e uma autorizacao explicita por e-mail ou papel. */
export async function requireAuthorizedUser(){
  const user=await requireAuthenticatedUser();
  if(!permissionsForUser(user).canUseSharedOperations){const error=new Error('authorization_required');error.status=403;throw error;}
  return user;
}

/** Exige a permissao exclusiva para publicar ou revisar o mapa compartilhado. */
export async function requireMapAdministrator(){
  const user=await requireAuthenticatedUser();
  if(!permissionsForUser(user).canManageSharedMap){const error=new Error('map_admin_required');error.status=403;throw error;}
  return user;
}

/** Converte falhas de identidade em codigos seguros para a interface. */
export function authorizationError(error){
  if(error?.status===401)return {status:401,body:{error:'authentication_required'}};
  if(error?.status===403)return {status:403,body:{error:'authorization_required'}};
  return null;
}
