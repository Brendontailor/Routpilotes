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
        CONSTRAINT routepilot_scope_allowed CHECK (scope IN ('shared', 'user', 'review')),
        CONSTRAINT routepilot_collection_allowed CHECK (collection IN ('technicians', 'workOrders', 'agendas', 'settings', 'notes', 'addressCorrections', 'mapChangeRequests', 'mapFeatures')),
        CONSTRAINT routepilot_payload_is_object CHECK (jsonb_typeof(payload) = 'object')
      )`;
      await sql`ALTER TABLE routepilot_records ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE`;
      const constraints=await sql`SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='routepilot_records'::regclass AND conname IN ('routepilot_scope_allowed','routepilot_collection_allowed')`;
      const definitions=Object.fromEntries(constraints.map(item=>[item.conname,item.definition]));
      if(!definitions.routepilot_scope_allowed?.includes("'review'")||!definitions.routepilot_collection_allowed?.includes("'mapFeatures'"))await sql.transaction(tx=>[
        tx`LOCK TABLE routepilot_records IN ACCESS EXCLUSIVE MODE`,
        tx`ALTER TABLE routepilot_records DROP CONSTRAINT IF EXISTS routepilot_scope_allowed`,
        tx`ALTER TABLE routepilot_records ADD CONSTRAINT routepilot_scope_allowed CHECK (scope IN ('shared', 'user', 'review'))`,
        tx`ALTER TABLE routepilot_records DROP CONSTRAINT IF EXISTS routepilot_collection_allowed`,
        tx`ALTER TABLE routepilot_records ADD CONSTRAINT routepilot_collection_allowed CHECK (collection IN ('technicians', 'workOrders', 'agendas', 'settings', 'notes', 'addressCorrections', 'mapChangeRequests', 'mapFeatures'))`
      ]);
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
