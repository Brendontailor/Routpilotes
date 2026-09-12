/* Entrada pequena que transforma @netlify/identity em dependencia local do navegador. */
import {getUser,handleAuthCallback,logout,oauthLogin,onAuthChange,refreshSession} from '@netlify/identity';

globalThis.RoutePilotIdentityProvider={getUser,handleAuthCallback,logout,oauthLogin,onAuthChange,refreshSession};
