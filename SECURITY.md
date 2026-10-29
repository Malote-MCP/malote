# Política de segurança

O Malote lida com conversas pessoais de WhatsApp. Levamos relatos de vulnerabilidade a sério e agradecemos a quem os envia com responsabilidade.

## Como relatar uma vulnerabilidade

**Não abra issue, discussão ou pull request público para vulnerabilidades.** Envie um e-mail para:

**luvi.germanos@coraassist.com**

Inclua, se possível:

- descrição do problema e do impacto (o que um atacante consegue ler, enviar ou alterar);
- passos para reproduzir, ou uma prova de conceito;
- commit, rota ou arquivo afetado;
- se você acessou dados de alguém além de você mesmo (o que esperamos que não aconteça).

Vamos confirmar o recebimento, investigar e manter você informado sobre a correção. Pedimos que não divulgue o problema publicamente antes de ele ser corrigido ou de combinarmos uma data com você. Se quiser, damos crédito no registro da correção.

**Não envie tokens (`mlt_...`), QR codes de conexão, senhas ou mensagens de terceiros** no relato. Se precisar demonstrar acesso a dados, use a sua própria conta.

## Escopo

Dentro do escopo:

- o serviço hospedado em https://malote.io, incluindo o painel (`/app`), autenticação, `/api/mcp`, `/api/tokens`, `/api/whatsapp`, `/api/media/[id]` e `/api/transparency`;
- o worker (`apps/worker`): sessões do WhatsApp, ingestão, fila de comandos e limites de envio;
- a criptografia e o acesso a dados em `packages/db` (`crypto.ts`, `queries.ts`, `commands.ts`, migrações);
- isolamento entre contas: qualquer forma de um usuário ler, enviar ou baixar mídia pela conta de outro;
- tokens: geração, verificação, revogação e o envelope da chave privada;
- o pipeline de build e CI (`.github/workflows`, `apps/*/Dockerfile`), incluindo qualquer coisa que quebre a reprodutibilidade da imagem do worker sem ser detectada.

Fora do escopo:

- o WhatsApp e os servidores da Meta;
- vulnerabilidades do Baileys ou de outras dependências que não afetem o Malote (relate ao projeto original; se afetarem o Malote, queremos saber);
- a infraestrutura de terceiros (Fly.io, Neon, GitHub) e os clientes MCP (Claude Code, Claude Desktop, `mcp-remote`);
- banimento ou restrição de contas pelo WhatsApp: é um risco conhecido e documentado do uso de cliente não oficial;
- negação de serviço por volume, spam, engenharia social e ataques físicos;
- as limitações listadas abaixo, a menos que você encontre uma forma de explorá-las além do que está descrito.

Ao testar, use apenas a sua própria conta e o seu próprio número de WhatsApp, não acesse dados de outras pessoas e não degrade o serviço para outros usuários.

## Versões suportadas

Corrigimos o branch `main` e o serviço hospedado em https://malote.io. Não mantemos versões antigas.

## Limitações conhecidas

O modelo completo está em https://malote.io/seguranca. Estas são limitações do desenho atual, não falhas a serem relatadas:

- **O servidor vê o conteúdo em texto claro durante o processamento.** O worker recebe as mensagens do WhatsApp em claro antes de cifrá-las e mantém em memória a chave AES da época atual (renovada pelo menos a cada 24 h). O web app recebe o token a cada chamada MCP, abre a chave privada e decifra o conteúdo em memória para responder. Não é criptografia de ponta a ponta, e um operador que alterasse o código poderia capturar conteúdo.
- **Credenciais da sessão do WhatsApp cifradas com uma chave do servidor.** As credenciais do Baileys (`wa_auth`) são cifradas com `MALOTE_ENCRYPTION_KEY`, que o worker precisa para reconectar sozinho. Quem tiver essa chave e o banco consegue assumir a sessão e receber mensagens novas. Essa proteção é independente da chave do usuário.
- **Metadados em claro.** JIDs/LIDs, números de telefone, horários, tipo e direção das mensagens, marcas de editada/apagada, IDs de mensagens citadas, tipo e tamanho dos arquivos baixados, além do número, nome e status da conexão, ficam sem cifra no banco.
- **Fila de comandos com texto claro.** Envios, respostas e downloads levam conteúdo em claro no `payload` da tabela `commands` enquanto são processados. O payload é apagado quando o comando termina ou expira e as linhas concluídas são removidas, e um comando interrompido no meio da execução (por exemplo, se o worker cair) tem o payload apagado quando o worker reinicia ou depois de 10 minutos. Até lá, o conteúdo fica no banco.
- **`/api/transparency` é autodeclarado.** O commit e a referência de imagem exibidos são informados pelos próprios servidores. Isso ajuda a acompanhar mudanças, mas não é atestação independente do que está rodando.
- **Sem enclave nem atestação remota (ainda).** O build do worker é reproduzível e verificado no CI, mas não há como provar hoje, de fora, que a imagem em produção é a construída a partir de um commit público. Rodar o worker em enclave com atestação remota está planejado. O workflow de deploy com atestado de proveniência existe no repositório, mas está desativado no momento.
- **Token com acesso total.** Um token `mlt_...` lê o histórico e envia mensagens; não há escopo somente leitura. Revogar um token impede novas chamadas, mas não recolhe dados já entregues ao cliente MCP.
- **Perda de todos os tokens.** Sem um token válido, a chave privada não pode ser aberta; recuperar o acesso exige gerar uma chave nova, o que apaga o histórico cifrado com a anterior.
- **Limites de envio em memória.** Os contadores de 10 envios/minuto e 200/dia ficam na memória do worker e zeram quando ele reinicia.
- **Cliente não oficial.** O Malote usa o Baileys, que não é autorizado pelo WhatsApp. A conta pode ser restringida ou banida.
- **Dados entregues ao assistente.** O que as ferramentas devolvem vai para o cliente MCP que você conectou e, a partir dele, segue as regras do provedor desse assistente.
