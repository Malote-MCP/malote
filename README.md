# Malote

Malote é um servidor MCP hospedado que conecta o **seu WhatsApp pessoal** ao **seu Claude** (Claude Code ou Claude Desktop). Você vincula o WhatsApp por QR code, como faria com o WhatsApp Web, gera um token e o Claude passa a poder ler, buscar e enviar mensagens e arquivos por meio de 8 ferramentas MCP.

Serviço hospedado: **https://malote.io** · Segurança e transparência: **https://malote.io/seguranca** · Licença: [Apache-2.0](LICENSE)

## O que é e o que não é

**É:**

- Uma ponte entre uma conta pessoal do WhatsApp e um cliente MCP que você controla.
- Um serviço sem IA no servidor: o Malote não chama nenhum modelo de linguagem. Quem interpreta as mensagens é o Claude que você conecta.
- Código aberto sob Apache-2.0. Veja [Imagem do worker reproduzível](#imagem-do-worker-reproduzível) para o que dá e o que não dá para verificar hoje sobre a versão que roda em produção.

**Não é:**

- Um produto da Meta nem integração oficial. O Malote usa o [Baileys](https://github.com/WhiskeySockets/Baileys), um cliente **não oficial** do protocolo do WhatsApp Web. Leia [Risco do cliente não oficial](#risco-do-cliente-não-oficial-e-limites-de-envio).
- Uma ferramenta de disparo em massa, chatbot ou atendimento. Os limites de envio são deliberadamente baixos.
- Criptografia de ponta a ponta. O servidor processa o conteúdo em texto claro na memória. Veja [Modelo de segurança](#modelo-de-segurança).
- Uma API do WhatsApp Business.

## Arquitetura

O repositório é um monorepo pnpm com três pacotes:

| Pacote | Caminho | O que faz |
| --- | --- | --- |
| `@malote/web` | `apps/web` | Next.js 16: landing page, `/seguranca`, painel em `/app` (login via Neon Auth), endpoint MCP em `/api/mcp` e as rotas `/api/tokens`, `/api/whatsapp`, `/api/media/[id]` e `/api/transparency`. |
| `@malote/worker` | `apps/worker` | Processo Node de longa duração que mantém uma sessão Baileys por usuário, grava o histórico cifrado no Postgres e executa os comandos da fila (enviar, baixar mídia, conectar, desconectar, trocar chave). Só faz conexões de saída. |
| `@malote/db` | `packages/db` | Schema Drizzle, migrações SQL, criptografia (`crypto.ts`), consultas e busca sobre o conteúdo cifrado (`queries.ts`) e a fila de comandos (`commands.ts`). |

```
  Claude Code / Claude Desktop
            │  HTTPS (Streamable HTTP)
            │  Authorization: Bearer mlt_...
            ▼
  ┌───────────────────────────┐    lê e decifra (chave do token, em memória)
  │  apps/web  (Next.js)      │◄───────────────────────────────────────┐
  │  /api/mcp  /app  /api/... │                                        │
  └─────────────┬─────────────┘                                        │
                │ INSERT em commands                                   │
                │ (trigger → pg_notify('malote_commands'))             │
                ▼                                                      │
  ┌───────────────────────────────────────────────────────────────────┴┐
  │  Postgres (Neon)                                                   │
  │  wa_sessions · wa_auth · chats · contacts · messages · media_files │
  │  enc_epochs · commands · api_tokens · workers                      │
  └─────────────┬──────────────────────────────────────────────────────┘
                │ LISTEN malote_commands (conexão direta, não pooled)
                │ + varredura a cada 5 s
                ▼
  ┌───────────────────────────┐        WebSocket (Baileys)
  │  apps/worker              │◄──────────────────────────────►  WhatsApp
  │  uma sessão por usuário   │
  └───────────────────────────┘
```

### Fila de comandos

O web app e o worker não conversam diretamente; eles se comunicam pela tabela `commands`:

1. O web app insere um comando (`connect`, `logout`, `rekey`, `send_text`, `send_file` ou `download_media`). O trigger da migração `0001_commands_notify.sql` dispara `pg_notify('malote_commands', id)`.
2. O worker escuta o canal com `LISTEN` numa conexão direta (`DATABASE_URL_UNPOOLED`) e, por segurança, também varre a fila a cada 5 segundos. Ele reivindica até 20 comandos por vez com `FOR UPDATE SKIP LOCKED`.
3. Ao terminar, o worker grava `status`/`result` e **apaga o `payload`**. Nas ferramentas MCP, o web app espera o resultado (polling, até 45 s) e apaga a linha.
4. Comandos pendentes há mais de 30 segundos expiram sem executar (nunca se envia algo velho, nem algo que o Claude já recebeu como falha). Comandos concluídos há mais de 5 minutos são apagados; comandos presos em execução por mais de 10 minutos, ou deixados por um worker anterior, têm o conteúdo apagado.

Como o worker não tem a chave do usuário, o web app coloca no `payload` o texto claro que o comando precisa (o texto a enviar, o arquivo, a mensagem original para responder ou baixar mídia).

### Fluxo de uso

1. O usuário entra em `/app` (Neon Auth) e gera um token. O primeiro token cria o par de chaves X25519 da conta.
2. Só depois disso o painel permite conectar o WhatsApp (sem chave, o worker não teria onde guardar o histórico com segurança). O worker abre um socket Baileys, publica o QR code em `wa_sessions` e o painel o exibe.
3. Depois do vínculo, o worker grava o histórico que o WhatsApp envia ao vincular um aparelho (o Malote não pede o histórico completo: `syncFullHistory: false`) e as mensagens novas. Status, canais (newsletters) e listas de transmissão são ignorados.
4. O Claude chama `/api/mcp` com o token; o web app abre a chave privada com o token, decifra o que foi pedido na memória e responde.

## As 8 ferramentas MCP

Definidas em `apps/web/app/api/mcp/route.ts`. Onde se pede `chat_jid`, também vale `"me"` (a conversa consigo mesmo) ou só os dígitos de um número.

| Ferramenta | Parâmetros | O que faz |
| --- | --- | --- |
| `whatsapp_status` | — | Status da conexão, número, nome, último sinal e último erro. |
| `list_chats` | `query?`, `limit?` (1–200, padrão 30) | Conversas e grupos, mais recentes primeiro; `query` filtra pelo nome. |
| `get_messages` | `chat_jid`, `limit?` (1–200, padrão 30), `before?` (ISO 8601) | Mensagens de uma conversa em ordem cronológica, com paginação para trás. |
| `search_messages` | `query`, `chat_jid?`, `from_me?`, `since?`, `until?`, `limit?` | Busca por texto e nome de arquivo, sem diferenciar maiúsculas e acentos; todas as palavras precisam aparecer; aspas buscam a frase exata. Como o conteúdo é cifrado, a busca decifra mensagem a mensagem com orçamento de ~12 s: se `complete` vier `false`, repita com `until = scanned_until`. |
| `search_contacts` | `query` | Contatos e grupos por nome ou número; devolve o `jid`. |
| `send_message` | `chat_jid`, `text` (até 4000 caracteres), `reply_to_message_id?` | Envia texto, opcionalmente como resposta a uma mensagem. Sujeito aos [limites de envio](#risco-do-cliente-não-oficial-e-limites-de-envio). |
| `send_file` | `chat_jid`, `media_id?` ou `base64` + `mimetype` + `file_name?`, `caption?` | Envia foto, vídeo, áudio ou documento (até 25 MB). `media_id` reenvia uma mídia baixada. |
| `download_media` | `chat_jid`, `message_id` | Baixa a mídia de uma mensagem (até 25 MB), guarda cifrada e devolve `media_id` e uma URL `/api/media/<id>` que exige o mesmo Bearer token. Imagens JPEG/PNG/GIF/WebP com menos de 3 MB vêm inline. |

O token dá acesso a todas as ferramentas, inclusive envio. Não existe hoje um token somente leitura.

## Como conectar o Claude

Entre em https://malote.io/app, gere um token (`mlt_...`) e conecte o WhatsApp pelo QR code. O token aparece **uma única vez** e é ele que abre a chave do seu histórico: guarde como senha.

### Claude Code

```sh
claude mcp add --transport http malote https://malote.io/api/mcp \
  --header "Authorization: Bearer mlt_..."
```

### Claude Desktop

O Claude Desktop usa o [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) como ponte (requer Node.js). Em `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "malote": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://malote.io/api/mcp", "--header", "Authorization: Bearer ${MALOTE_TOKEN}"],
      "env": { "MALOTE_TOKEN": "mlt_..." }
    }
  }
}
```

O painel mostra os dois trechos já preenchidos com o seu token.

## Modelo de segurança

Resumo; a explicação completa está em **https://malote.io/seguranca**, e as limitações conhecidas em [SECURITY.md](SECURITY.md).

- **Chave por usuário.** Cada conta tem um par X25519. A chave pública fica em `wa_sessions.public_key`.
- **Escrita sem o usuário presente.** O worker cifra o conteúdo por "época": gera uma chave X25519 efêmera, faz ECDH com a chave pública do usuário, deriva uma chave AES-256-GCM com HKDF-SHA256 e a mantém só em memória. A chave pública efêmera vai para `enc_epochs`. Uma época nova começa pelo menos a cada 24 h ou quando a chave do usuário muda.
- **Chave privada embrulhada pelo token.** A chave privada só é guardada cifrada (AES-256-GCM) com uma chave derivada de cada token MCP (`api_tokens.wrapped_key`). O banco guarda apenas o hash SHA-256 do token. Revogar um token apaga o envelope correspondente.
- **O que é cifrado:** texto e legendas, nome do remetente, informações de mídia, o payload bruto da mensagem (necessário para baixar mídia), nomes de conversas e contatos e os arquivos baixados.
- **O que fica em claro (metadados):** identificadores de conversas e contatos (JIDs/LIDs), números de telefone, horários, tipo e direção das mensagens, marcas de editada/apagada, IDs de mensagens citadas, tipo e tamanho dos arquivos, e os dados da própria conexão (número, nome, status).
- **Não é ponta a ponta.** O worker recebe as mensagens do WhatsApp em claro antes de cifrar; o web app recebe o seu token a cada chamada e decifra em memória para responder; a fila de comandos carrega texto claro enquanto processa. Um operador que alterasse o código poderia capturar conteúdo. O que a criptografia protege é o **banco sozinho**: uma cópia do banco sem os tokens não basta para ler o conteúdo.
- **Sessão do WhatsApp.** As credenciais do Baileys (`wa_auth`) são cifradas com AES-256-GCM usando uma chave do servidor (`MALOTE_ENCRYPTION_KEY`), para que o worker possa reconectar sozinho. Essa proteção é diferente da chave do usuário.
- **Perder todos os tokens** significa perder o histórico guardado: o único caminho é gerar uma chave nova, o que apaga mensagens e mídias cifradas com a antiga e revoga os tokens existentes.

## Risco do cliente não oficial e limites de envio

O WhatsApp não oferece API para contas pessoais. O Malote se conecta como um aparelho vinculado (identificando-se como um app desktop de macOS, visível em *Aparelhos conectados*) usando o Baileys. Esse uso não é autorizado pelo WhatsApp, pode violar seus termos de uso e pode levar a restrição ou banimento do número. Use por sua conta e risco, e de preferência não com um número do qual você dependa criticamente.

Para reduzir o risco, o worker (`apps/worker/src/policy.ts` e `session.ts`) aplica, para envios vindos do MCP ou do painel:

- **Só conversas que já existem** no histórico guardado (ou a conversa consigo mesmo). Não envia para números novos.
- **10 envios por minuto e 200 por dia** por sessão (configuráveis com `MALOTE_SENDS_PER_MINUTE` e `MALOTE_SENDS_PER_DAY`). Os contadores ficam em memória no worker e zeram quando ele reinicia.
- Mostra "digitando…" por 0,8–2 s antes de cada envio.
- Não marca a conta como online ao conectar.
- Reconexões com backoff exponencial e jitter (até 60 s); ao iniciar, retoma as sessões espaçadas de 3 em 3 segundos.
- Comandos que esperaram mais de 30 segundos na fila expiram em vez de executar.

Esses controles reduzem, mas **não eliminam**, o risco de bloqueio.

## Rodando localmente

Pré-requisitos: Node.js 22, pnpm 10 (`corepack enable` usa a versão de `packageManager`) e um projeto [Neon](https://neon.tech) com Neon Auth, porque o login do painel depende dele (`neon.ts` declara o Auth ligado e faz branches novos expirarem em 7 dias).

> **Use um banco só seu.** Nunca aponte um worker local para o banco de produção: **só pode haver um worker por banco de dados**. Dois workers abririam as mesmas sessões do WhatsApp e uma derrubaria a outra (é por isso que `fly.worker.toml` roda exatamente uma máquina). Um branch Neon próprio resolve.

### 1. Instalar

```sh
pnpm install
```

### 2. Variáveis de ambiente

Os scripts de desenvolvimento leem `.env.local` na raiz do repositório (ignorado pelo git). Variáveis usadas pelo código:

| Variável | Usada por | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | web, worker | Conexão Postgres (pode ser a pooled). |
| `DATABASE_URL_UNPOOLED` | worker, migrações | Conexão direta, necessária para `LISTEN/NOTIFY` e migrações. Se ausente, usa `DATABASE_URL`. |
| `NEON_AUTH_BASE_URL` | web | URL do Neon Auth do seu projeto. |
| `NEON_AUTH_COOKIE_SECRET` | web | Segredo dos cookies de sessão. |
| `MALOTE_ENCRYPTION_KEY` | worker | 32 bytes em base64 que cifram as credenciais do WhatsApp. Gere com `openssl rand -base64 32`. Se mudar, as sessões existentes precisam ser vinculadas de novo. |
| `PUBLIC_URL` | web | URL pública do app. Padrão `https://malote.io`; em desenvolvimento use `http://localhost:3000`, senão as URLs de mídia e mensagens apontam para produção. |
| `LOG_LEVEL` | worker | Nível do pino (padrão `info`). |
| `MALOTE_SENDS_PER_MINUTE`, `MALOTE_SENDS_PER_DAY` | worker | Limites de envio (padrão 10 e 200). |
| `SOURCE_REPO`, `GIT_SHA` | web, worker | Exibidos em `/api/transparency`. Em produção vêm de `fly.web.toml` e do build. |

### 3. Migrações

```sh
pnpm db:migrate
```

Aplica as migrações de `packages/db/migrations` usando `DATABASE_URL_UNPOOLED` (ou `DATABASE_URL`). Ao mudar `packages/db/src/schema.ts`, gere uma migração nova com `pnpm db:generate` e versione o SQL e os arquivos de `migrations/meta`.

### 4. Subir web e worker

Em dois terminais:

```sh
pnpm dev:web      # Next.js em http://localhost:3000
pnpm dev:worker   # worker, lê ../../.env.local
```

Depois, entre em http://localhost:3000/app, gere um token, conecte um WhatsApp e aponte o Claude Code para `http://localhost:3000/api/mcp`.

## Testes e CI

```sh
pnpm typecheck   # tsc --noEmit em todos os pacotes
pnpm test        # testes com node:test em packages/db e apps/worker
```

- Os testes unitários cobrem criptografia (`packages/db/test/crypto.test.ts`), busca (`packages/db/test/search.test.ts`), parsing de mensagens (`apps/worker/test/ingest.test.ts`) e limites de envio (`apps/worker/test/policy.test.ts`).
- Os testes de integração em `apps/worker/test/storage.test.ts` só rodam com `DATABASE_URL_TEST` apontando para um Postgres **descartável**: eles aplicam as migrações e gravam dados. Sem a variável, aparecem como `SKIP`. Exemplo:

  ```sh
  docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:17
  DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/postgres pnpm test
  ```

O CI (`.github/workflows/ci.yml`) roda em todo push e pull request:

- **`test`**: `pnpm install --frozen-lockfile`, `pnpm typecheck` e `pnpm test`, com um Postgres 17 como serviço (os testes de integração rodam).
- **`reproducible-worker`**: constrói a imagem do worker duas vezes do zero e exige o mesmo digest (veja abaixo).

O workflow `.github/workflows/deploy.yml` (migrar, construir, atestar proveniência e publicar por digest no Fly.io) existe no repositório mas **está desativado no GitHub** no momento. Por isso, hoje não há atestados de proveniência publicados para as imagens em produção.

## Imagem do worker reproduzível

O worker é o processo que recebe as mensagens do WhatsApp em claro, então a ideia é que qualquer pessoa possa conferir que uma imagem foi gerada a partir de um commit público. Para isso, o build precisa ser reproduzível: o mesmo commit sempre gera o mesmo digest.

O que torna isso possível (`apps/worker/Dockerfile`):

- imagem base `node:22-slim` fixada por digest;
- `pnpm install --frozen-lockfile`, com remoção dos arquivos de estado do pnpm que carregam data/hora (`.modules.yaml`, `node_modules/.pnpm-workspace-state*.json`) e dos caches;
- `SOURCE_DATE_EPOCH` igual à data do commit e `rewrite-timestamp=true`, que normalizam as datas dos arquivos.

O job `reproducible-worker` do CI constrói duas vezes com `--no-cache` e falha se os digests forem diferentes; nesse caso, `scripts/diff-oci.py` lista os arquivos que diferem. O digest aparece no resumo do job ("Worker image digest").

### Reconstruindo e comparando

Com Docker e buildx (BuildKit com suporte a `rewrite-timestamp`):

```sh
git clone https://github.com/Malote-MCP/malote && cd malote
git checkout <commit>
export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)
docker buildx build --no-cache \
  --file apps/worker/Dockerfile \
  --build-arg GIT_SHA=$(git rev-parse HEAD) \
  --build-arg SOURCE_DATE_EPOCH \
  --output type=oci,dest=/tmp/worker.tar,rewrite-timestamp=true \
  --metadata-file /tmp/meta.json .
jq -r '."containerimage.digest"' /tmp/meta.json
```

Compare o resultado com o digest do resumo do job `reproducible-worker` na execução de **push** daquele commit (em pull requests, o `GIT_SHA` usado pelo CI é o do merge commit, não o do branch). `GIT_SHA` entra na configuração da imagem, então precisa ser o hash completo do commit. Se os digests divergirem, `python3 scripts/diff-oci.py a.tar b.tar` mostra onde.

**O que isso prova e o que não prova:** um digest igual mostra que aquela imagem vem daquele código. Não prova que é essa imagem que roda em produção. Hoje, `/api/transparency` informa o commit e a referência da imagem que os próprios servidores declaram, o que **não é uma atestação independente**. Execução em enclave com atestação remota está planejada, mas ainda não existe.

## Hospedagem

O serviço em https://malote.io roda no [Fly.io](https://fly.io) na região `gru` (São Paulo): `fly.web.toml` (app `malote-web`) e `fly.worker.toml` (app `malote-worker`, uma única máquina, sem porta HTTP). O banco é Postgres na Neon. Além do WhatsApp e do banco, o worker faz uma chamada a `https://api.ipify.org` ao iniciar para registrar o IP de saída e consulta a versão mais recente do protocolo do WhatsApp Web pelo Baileys.

## Segurança

Para relatar uma vulnerabilidade, **não abra issue pública**: veja [SECURITY.md](SECURITY.md).

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[Apache License 2.0](LICENSE).

WhatsApp é marca registrada da Meta Platforms, Inc. O Malote não tem relação com a Meta nem com o WhatsApp. Claude é um produto da Anthropic; o Malote também não é afiliado à Anthropic.
