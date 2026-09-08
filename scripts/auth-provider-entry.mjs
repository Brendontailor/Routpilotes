/* Entrada pequena que transforma @netlify/identity em dependencia local do navegador. */
import {getUser,handleAuthCallback,logout,oauthLogin,onAuthChange} from '@netlify/identity';

globalThis.RoutePilotIdentityProvider={getUser,handleAuthCallback,logout,oauthLogin,onAuthChange};
