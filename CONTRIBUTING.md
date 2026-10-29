# Contribuindo com o Malote

Obrigado pelo interesse. Contribuições são bem-vindas: correções, testes, documentação e melhorias de segurança.

Vulnerabilidades **não** devem virar issue pública: siga o [SECURITY.md](SECURITY.md).

## Ambiente

Requer Node.js 22 e pnpm 10 (`corepack enable`).

```sh
pnpm install
pnpm typecheck
pnpm test
```

Para rodar o web app e o worker, veja [Rodando localmente](README.md#rodando-localmente) no README. Use sempre um banco seu (um branch Neon, por exemplo) e **um worker só por banco**.

## Fluxo

1. Faça um fork (ou um branch, se tiver acesso) a partir de `main`.
2. Mantenha cada pull request focado em uma mudança, com uma descrição do que muda e por quê.
3. Mudou o schema (`packages/db/src/schema.ts`)? Gere a migração com `pnpm db:generate` e inclua no PR o SQL e os arquivos de `packages/db/migrations/meta`.
4. Abra o pull request para `main`.

## Requisitos para o merge

- **O CI precisa estar verde**: `pnpm typecheck`, `pnpm test` (com os testes de integração no Postgres do CI) e o job `reproducible-worker`.
- **Mudanças em criptografia ou parsing vêm com testes.** Isso inclui `packages/db/src/crypto.ts`, `packages/db/src/queries.ts` (busca e decifra), `apps/worker/src/ingest.ts` (parsing de mensagens), `apps/worker/src/legacy.ts` e `apps/worker/src/policy.ts`. Os testes ficam em `packages/db/test` e `apps/worker/test`. Para os testes de integração localmente, aponte `DATABASE_URL_TEST` para um Postgres descartável (eles aplicam migrações e gravam dados).
- **Nunca versione segredos.** `.env.local` e `.env` estão no `.gitignore`; não cole tokens `mlt_...`, URLs de banco, `MALOTE_ENCRYPTION_KEY` nem QR codes em código, testes, logs, issues ou PRs.
- **Mantenha o build do worker reproduzível.** O mesmo commit precisa gerar o mesmo digest. Não adicione à imagem arquivos com data/hora, IDs aleatórios ou caches gerados no build; não troque a imagem base fixada por digest por uma tag; e, se uma dependência nova gravar estado durante o `pnpm install`, remova-o no `Dockerfile` como já é feito com `.modules.yaml`. Se o job falhar, o log traz a saída de `scripts/diff-oci.py` com os arquivos que diferem.
- Envio de mensagens: não afrouxe os limites de `apps/worker/src/policy.ts` nem a regra de só enviar para conversas existentes sem discutir antes numa issue.

## Licença

Ao contribuir, você concorda que sua contribuição é licenciada sob a [Apache License 2.0](LICENSE), conforme a seção 5 da licença.
