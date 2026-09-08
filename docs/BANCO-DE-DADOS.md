# Banco de dados do RoutePilot

## Arquitetura

O navegador nunca se conecta diretamente ao Neon:

```text
RoutePilot PWA -> Netlify Identity -> Netlify Function -> Neon Postgres
```

O mapa e os dados geográficos estáticos continuam funcionando sem login. A área de Agenda usa autenticação para compartilhar a operação com segurança.

## Dados compartilhados

- técnicos;
- ordens de serviço;
- agendas diárias;
- correções manuais de endereço sem dados de cliente.

## Dados privados por usuário

- filtros e preferências;
- anotações operacionais vinculadas a coordenadas.

Anotações nunca são ligadas diretamente a clientes e sua validação não modifica automaticamente o mapa estrutural.

## Configuração no Netlify

1. Ative o Netlify Identity no site.
2. Ative o provedor externo Google.
3. Configure `DATABASE_URL` com a conexão pooled do Neon.
4. Configure `ROUTEPILOT_ALLOWED_EMAILS` com os e-mails permitidos, separados por vírgula.
5. Faça um novo deploy pelo Git.

Usuários com papel `routepilot` ou `admin` também são autorizados. O Geoapify é independente e usa a variável opcional `GEOAPIFY_API_KEY`.

Nunca grave valores dessas variáveis em arquivos do projeto, commits ou código enviado ao navegador.

## Arquivos

- `db/schema.sql`: esquema SQL de referência;
- `netlify/functions/_lib/database.mjs`: conexão privada e migração idempotente;
- `netlify/functions/_lib/authorization.mjs`: autenticação e autorização no servidor;
- `netlify/functions/database-status.mjs`: diagnóstico protegido e sem segredos;
- `netlify/functions/operational-data.mjs`: leitura, sanitização, gravação e tombstones;
- `js/auth.js`: login e sessão no navegador;
- `js/cloud-sync.js`: cliente único da API protegida;
- `js/agenda-storage.js`: IndexedDB e fila offline da operação;
- `js/notes-storage.js`: anotações privadas e estados de sincronização;
- `js/address-corrections-storage.js`: correções geográficas compartilhadas.

## Verificação após o deploy

Entre com uma conta autorizada e abra `/api/database-status` no mesmo domínio. A resposta esperada é:

```json
{
  "ok": true,
  "database": "connected",
  "collections": {}
}
```

O primeiro acesso autenticado cria ou atualiza o esquema. Sem login a resposta deve ser `401`; com uma conta não autorizada, `403`.

## Sincronização offline

O IndexedDB recebe a alteração primeiro. A Agenda registra uma fila durável com uma entrada por coleção e ID, repete o envio com segurança após reconexão e só remove a pendência depois da confirmação do servidor. Exclusões são preservadas como tombstones para que dados antigos de outro computador não reapareçam.

Conflitos usam `updatedAt`: a versão mais recente vence. Ainda não existe uma interface para conciliar manualmente duas edições simultâneas do mesmo registro.

## Segurança

A função aceita somente coleções conhecidas, deriva a identidade da sessão, aplica autorização no servidor, descarta campos não permitidos, limita o tamanho das requisições e usa consultas parametrizadas. Senhas, logins de clientes, tokens, chaves e credenciais nunca são aceitos como parte das OS.
