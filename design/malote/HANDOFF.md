# Site Malote — entrega para integração

O usuário pediu a transferência deste site para o Claude que implementa o Malote neste mesmo checkout. As alterações abaixo estão nos arquivos compartilhados, sem commit ou publicação por este agente.

## Resultado

- One pager em português, com marca fornecida pelo usuário, apresentação do produto, funcionalidades, conexão, segurança, transparência e FAQ.
- Demo interativa na primeira dobra: token, QR ilustrativo, configuração do Claude e perguntas sobre mensagens e arquivos. Reprodução automática, pausa, seleção de etapas e exemplos fictícios. Respeita movimento reduzido e pausa fora da tela.
- Segurança explica X25519/AES-256-GCM, proteção da chave pelo token, metadados, processamento no servidor, fila temporária, legado e limites da revogação.
- Repositório público confirmado: https://github.com/Malote-MCP/malote — Apache-2.0. Conteúdo atualizado para remover o aviso anterior de repositório privado.
- Botão fixo **Star no GitHub** no canto inferior direito das páginas públicas, abrindo o repositório em outra aba. Sem contador inventado e sem efetuar estrelas em nome do usuário.
- L&P Soluções, CNPJ 63.030.646/0001-31; contato luvi.germanos@coraassist.com.

## Arquivos da entrega

- `apps/web/app/page.tsx` — home.
- `apps/web/app/seguranca/page.tsx` — detalhes de segurança e transparência.
- `apps/web/app/layout.tsx` — metadata.
- `apps/web/app/globals.css`, `landing.css`, `product-demo.css`, `trust.css` — estilos.
- `apps/web/components/product-demo.tsx`, `github-star.tsx`, `logo.tsx`.
- `apps/web/lib/public-info.ts` — URL do repositório e do endpoint do serviço hospedado.
- `apps/web/public/malote-brand.png` — marca fornecida, enquadrada com viewport SVG.
- `apps/web/Dockerfile` — inclui cópia de `public/` para o runtime standalone. Necessária para servir o logo em produção.
- `design/malote/` — conceito de marca e revisão independente.

## Verificação

- Site e referência https://polar.sh/ inspecionados no navegador Orca. Comparação em `design/malote/revisao-site.md`.
- Demo inteira na primeira dobra desktop; verificações de largura 390px sem overflow. Página de segurança conferida visualmente e em largura de celular.
- Build Webpack completo passou antes dos últimos ajustes de conteúdo/segurança/GitHub; a checagem de TypeScript passou após os ajustes de segurança.
- `pnpm test`: 22 aprovados, 4 testes de integração ignorados por ausência de `DATABASE_URL_TEST`. Isso não equivale a auditoria de segurança.
- Último ajuste, botão Star: `git diff --check` e HTML servido pela home conferidos; link, texto, componente e status público/Apache 2.0 presentes. Revalidar TypeScript e apresentação do botão antes da publicação final.
- Endpoint hospedado `/api/transparency` respondeu durante a revisão. Ele declara versões; não é prova independente do código em execução. A existência do workflow de proveniência não comprova atestados públicos para toda imagem.

## Continuidade

Prévia atual: http://localhost:3100/ e http://localhost:3100/seguranca. Ela foi iniciada com valores fictícios para autenticação/banco, apenas para renderizar páginas públicas; os fluxos autenticados não foram validados nessa prévia. O comando normal do projeto é `pnpm dev:web`, usando a configuração local existente.

Assumir integração com o restante da implementação, revisar os diffs e executar as verificações finais do seu fluxo. Preservar mudanças concorrentes de backend, testes e infraestrutura. O usuário corrigiu a referência visual para **polar.sh**, não polaris.sh.
