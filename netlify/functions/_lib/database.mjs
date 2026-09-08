/* Conexao privada com o Neon. Este arquivo existe apenas no ambiente serverless. */
import {neon} from '@neondatabase/serverless';

let schemaPromise=null;

/** Abre o cliente HTTP do Neon sem expor a string de conexao ao navegador. */
export function getDatabase(){
  const connectionString=process.env.DATABASE_URL;
  if(!connectionString){
    const error=new Error('Banco de dados nao configurado');
    error.code='DATABASE_NOT_CONFIGURED';
    throw error;
  }
  return neon(connectionString);
}

/** Garante de forma idempotente que as tabelas basicas do RoutePilot existam. */
export function ensureSchema(sql=getDatabase()){
  if(!schemaPromise){
    schemaPromise=(async()=>{
      await sql`CREATE TABLE IF NOT EXISTS routepilot_records (
        scope VARCHAR(16) NOT NULL,
        owner_id VARCHAR(160) NOT NULL,
        collection VARCHAR(32) NOT NULL,
        record_id VARCHAR(160) NOT NULL,
        payload JSONB NOT NULL,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_by VARCHAR(160) NOT NULL,
        updated_by VARCHAR(160) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (scope, owner_id, collection, record_id),
        CONSTRAINT routepilot_scope_allowed CHECK (scope IN ('shared', 'user')),
        CONSTRAINT routepilot_collection_allowed CHECK (collection IN ('technicians', 'workOrders', 'agendas', 'settings', 'notes', 'addressCorrections')),
        CONSTRAINT routepilot_payload_is_object CHECK (jsonb_typeof(payload) = 'object')
      )`;
      await sql`ALTER TABLE routepilot_records ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`CREATE INDEX IF NOT EXISTS routepilot_records_updated_at_idx
        ON routepilot_records (scope, owner_id, collection, updated_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS routepilot_records_collection_idx
        ON routepilot_records (collection, updated_at DESC)`;
      return sql;
    })().catch(error=>{schemaPromise=null;throw error;});
  }
  return schemaPromise;
}

/** Responde JSON sem incluir mensagens internas ou credenciais do provedor. */
export function json(body,{status=200}={}){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff'
    }
  });
}
