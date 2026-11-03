import Link from "next/link";
import { Logo } from "@/components/logo";
import { ProductDemo } from "@/components/product-demo";
import { repositoryUrl, transparencyUrl } from "@/lib/public-info";
import { VerificationBadge } from "@/components/verification-badge";
import { GitHubStar } from "@/components/github-star";

const steps = [
  { title: "Crie sua conta", body: "Acesse o painel com Google ou e-mail e senha. É por lá que você gerencia sua conexão e seus tokens de acesso." },
  { title: "Vincule seu WhatsApp", body: "Primeiro, gere seu token no painel. Depois escaneie o QR code em Aparelhos conectados, no WhatsApp do celular." },
  { title: "Adicione ao seu assistente", body: "Use seu token e as instruções do painel para configurar o Malote no Claude Desktop, Claude Code ou em outro cliente MCP." },
];

const tools = [
  ["list_chats", "Conversas e grupos"], ["get_messages", "Histórico de mensagens"],
  ["search_messages", "Busca por texto e período"], ["search_contacts", "Contatos e grupos por nome"],
  ["send_message", "Envio de texto e respostas"], ["send_file", "Envio de arquivos e mídias"],
  ["download_media", "Download de mídias recebidas"], ["whatsapp_status", "Estado da conexão"],
];

const questions = [
  { q: "O que é o Malote?", a: "O Malote é um serviço que conecta uma conta de WhatsApp a assistentes compatíveis com MCP (Model Context Protocol). Ele sincroniza conversas e disponibiliza ferramentas para consultar mensagens, buscar contatos, baixar mídias e enviar textos e arquivos." },
  { q: "O Malote tem inteligência artificial própria?", a: "Não. A interpretação dos seus pedidos é feita pelo assistente que você conecta, como o Claude. O Malote fornece os dados e executa as ferramentas chamadas por esse assistente. Consulte também as condições de tratamento de dados do provedor do assistente que você utilizar." },
  { q: "É uma integração oficial do WhatsApp?", a: "Não. O Malote usa uma biblioteca não oficial para se conectar como aparelho vinculado. Não é afiliado ao WhatsApp, à Meta ou à Anthropic. O uso pode contrariar os termos do WhatsApp e resultar em restrição ou bloqueio da conta. Os controles de envio não eliminam esse risco." },
  { q: "Quais dados são armazenados?", a: "O serviço armazena o histórico sincronizado e mídias baixadas. O mecanismo atual cifra conteúdo com AES-256-GCM, usando chaves X25519 e uma chave privada protegida pelo token. Metadados e dados necessários ao processamento têm tratamento diferente. O servidor recebe mensagens e tokens durante o uso; a página de Segurança e transparência explica esses limites e a migração de dados antigos." },
  { q: "O Malote é open source?", a: "Sim. O código está publicado em github.com/Malote-MCP/malote sob a licença Apache 2.0. Você pode consultar a implementação e contribuir pelo GitHub. Código aberto permite revisão, mas não equivale a uma auditoria de segurança nem comprova sozinho a versão executada pelos servidores." },
  { q: "Perdi todos os tokens. Consigo recuperar o histórico?", a: "Os tokens também protegem a chave que abre o conteúdo cifrado. Sem uma credencial válida que destrave essa chave, o fluxo atual exige criar outra chave e reinicializar o histórico armazenado. Guarde seu token como uma senha; não há recuperação da chave por e-mail." },
  { q: "Como falo com o responsável pelo serviço?", a: "Para suporte, dúvidas sobre o serviço ou solicitações relacionadas aos seus dados, escreva para contato@coraassist.com. Informe o e-mail da sua conta e descreva a solicitação. Não envie senhas, tokens ou códigos de conexão." },
  { q: "Como encerro o acesso?", a: "Você pode revogar um token no painel para interromper o acesso daquele cliente MCP. Para encerrar a conexão com o WhatsApp, use a opção de desconexão no painel ou remova o Malote em Aparelhos conectados no celular. Desconectar não equivale a excluir os dados já armazenados." },
  { q: "O assistente pode enviar mensagens?", a: "Sim. O token permite acesso às ferramentas de leitura e envio da sua conta; não há um modo de acesso somente para leitura. A ferramenta de envio de texto orienta o assistente a confirmar com você antes de enviar a outras pessoas, mas não existe uma etapa de aprovação obrigatória no painel. Configure e use seu assistente considerando esse acesso." },
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}

export default function Landing() {
  return (
    <div className="malote-site">
      <GitHubStar />
      <a href="#conteudo" className="site-skip">Pular para o conteúdo</a>
      <header className="site-header">
        <div className="site-container site-header-inner">
          <Logo />
          <VerificationBadge placement="header" />
          <nav className="site-nav" aria-label="Navegação principal">
            <a className="site-nav-section" href="#como-funciona">Como funciona</a>
            <a className="site-nav-section" href="#seguranca">Segurança</a>
            <a className="site-nav-section" href="#codigo">Código aberto</a>
            <Link className="site-login" href="/auth/sign-in">Entrar <Arrow diagonal /></Link>
          </nav>
        </div>
      </header>

      <main id="conteudo">
        <section className="site-container site-hero" aria-labelledby="hero-title">
          <div className="site-hero-copy">
            <p className="site-eyebrow"><span className="site-square" /> WHATSAPP CONECTADO AO SEU TRABALHO</p>
            <h1 id="hero-title">Seu WhatsApp.<br /><span>Dentro do Claude.</span></h1>
            <p className="site-lead">Encontre uma mensagem. Recupere aquele arquivo. Resolva o que ficou na conversa. O Malote conecta seu WhatsApp ao Claude e a outros assistentes via MCP.</p>
            <div className="site-actions">
              <Link className="site-button" href="/auth/sign-up">Conectar meu WhatsApp <Arrow diagonal /></Link>
              <a className="site-text-link" href="#como-funciona">Como funciona <Arrow /></a>
            </div>
            <p className="site-hero-note">Funciona com Claude Desktop, Claude Code e clientes MCP.</p>
          </div>

          <ProductDemo />
        </section>

        <div className="site-facts"><div className="site-container site-facts-inner"><p><strong>Conta pessoal</strong><span>Conexão por QR code</span></p><p><strong>Protocolo MCP</strong><span>Claude Desktop, Code e clientes compatíveis</span></p><p><strong>Acesso revogável</strong><span>Tokens gerenciados no painel</span></p></div></div>

        <section id="como-funciona" className="site-connection" aria-labelledby="conexao-title"><div className="site-container site-section">
          <div className="site-section-heading"><p className="site-eyebrow">01 / A CONEXÃO</p><h2 id="conexao-title">Do celular ao assistente,<br />em três etapas.</h2><p>Você precisa de uma conta de WhatsApp e de um cliente compatível com MCP. A configuração da conexão fica no painel.</p></div>
          <ol className="site-steps">{steps.map((step, i) => <li key={step.title}><span className="site-step-number">0{i + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
          <div className="site-protocol"><p><strong>Uma ponte entre ferramentas.</strong> O Malote sincroniza e disponibiliza o conteúdo. Seu assistente interpreta o pedido e escolhe quais ferramentas usar.</p><span>WhatsApp <Arrow /> Malote <Arrow /> MCP</span></div>
        </div></section>


        <section id="seguranca" className="site-container site-section site-security" aria-labelledby="seguranca-title">
          <div className="site-security-intro">
            <p className="site-eyebrow">02 / ACESSO E SEGURANÇA</p>
            <h2 id="seguranca-title">Seu histórico cifrado.<br />Seu acesso, revogável.</h2>
            <p>A proteção vai além da conexão com o WhatsApp. O conteúdo gravado no formato cifrado usa chaves por conta, e o token do seu assistente também protege o acesso à chave privada.</p>
            <Link className="site-text-link" href="/seguranca">Conheça a arquitetura e seus limites <Arrow diagonal /></Link>
          </div>
          <dl className="site-controls">
            <div><dt>Criptografia do conteúdo armazenado</dt><dd>X25519 e AES-256-GCM protegem mensagens, nomes e arquivos gravados no formato cifrado. Metadados e dados legados têm condições específicas.</dd></div>
            <div><dt>Tokens tratados como credenciais</dt><dd>O banco guarda o hash do token e a chave privada cifrada por uma chave derivada dele. Você pode revogar o acesso pelo painel.</dd></div>
            <div><dt>Controle sobre o vínculo</dt><dd>Desconecte pelo painel ou pelo celular. Revogar acessos não apaga cópias já consultadas, backups ou mensagens que já foram enviadas.</dd></div>
            <div><dt>Limites publicados</dt><dd>O servidor processa as mensagens e recebe o token nas consultas. A criptografia no armazenamento não elimina a confiança em quem opera o serviço.</dd></div>
          </dl>
        </section>

        <section id="codigo" className="site-transparency" aria-labelledby="codigo-title">
          <div className="site-container site-section">
            <div className="site-section-heading site-audit-heading">
              <p className="site-eyebrow">03 / CÓDIGO ABERTO</p>
              <h2 id="codigo-title">Audite.<br />Ou suba você mesmo.</h2>
              <p>Suas mensagens passam por um servidor nosso. Por isso ele roda numa caixa lacrada, sem porta de entrada nem para quem opera o Malote. E você não precisa acreditar na nossa palavra. Dá para conferir, com o código público e uma prova assinada pelo Google.</p>
            </div>

            <figure className="audit-map" aria-labelledby="audit-map-title">
              <div className="audit-map-heading"><div><p className="site-eyebrow">ARQUITETURA / FLUXO DAS MENSAGENS</p><h3 id="audit-map-title">Uma ponte protegida, de ponta a ponta.</h3></div><VerificationBadge placement="diagram" /></div>
              <div className="audit-flow">
                <div className="audit-endpoint"><span className="audit-icon" aria-hidden="true">▤</span><strong>Seu WhatsApp</strong><p>Suas conversas<br />e arquivos.</p></div>
                <div className="audit-connector"><span>mensagens</span><i aria-hidden="true">→</i></div>
                <div className="audit-enclave">
                  <div className="audit-enclave-label"><svg width="16" height="18" viewBox="0 0 20 22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="9" width="14" height="11" rx="2"/><path d="M6 9V6a4 4 0 0 1 8 0v3"/></svg> ÁREA PROTEGIDA</div>
                  <strong className="audit-malote">Malote</strong><p>Recebe, cifra e responde.</p>
                  <div className="audit-enclave-detail"><span>Google Confidential Space</span><span>Memória cifrada · TLS aqui dentro</span></div>
                </div>
                <div className="audit-connector"><span>via MCP</span><i aria-hidden="true">→</i></div>
                <div className="audit-endpoint"><span className="audit-icon" aria-hidden="true">✳</span><strong>Seu assistente</strong><p>Claude ou outro<br />cliente MCP.</p></div>
              </div>
              <div className="audit-boundaries">
                <div><span className="audit-boundary-symbol" aria-hidden="true">⌘</span><div><strong>Chaves sob condição</strong><p>O cofre do Google libera as chaves só para imagens na lista pública.</p></div></div>
                <div><span className="audit-boundary-symbol" aria-hidden="true">▥</span><div><strong>Banco fora da área protegida</strong><p>O conteúdo sai do Malote cifrado com X25519 + AES-256-GCM.</p></div></div>
                <div><span className="audit-boundary-symbol" aria-hidden="true">×</span><div><strong>Operação sem acesso interno</strong><p>A equipe do Malote fica de fora. Sem SSH e sem depuração.</p></div></div>
              </div>
              <div className="audit-proof">
                <div className="audit-proof-intro"><p className="site-eyebrow">DA FONTE À PROVA</p><p>Você confere o que roda.</p></div>
                <ol>
                  <li><span>01</span><strong>Código público</strong><small>No GitHub</small></li>
                  <li><span>02</span><strong>Build reproduzível</strong><small>Gera o digest da imagem</small></li>
                  <li><span>03</span><strong>Atestado do Google</strong><small>Assina esse mesmo digest</small></li>
                  <li><span>04</span><strong>Seu navegador</strong><small>Compara com a lista pública</small></li>
                </ol>
              </div>
              <figcaption>A prova conecta o código público à imagem em execução. <Link href="/seguranca#versao">Conferir a versão ao vivo <Arrow diagonal /></Link></figcaption>
            </figure>

            <div className="site-audit-grid">
              <div className="site-audit-why">
                <h3>Por que não conseguimos ler suas mensagens</h3>
                <dl>
                  <div><dt>O servidor é uma caixa lacrada</dt><dd>O worker roda numa máquina do Google Confidential Space. O processador (AMD SEV) cifra a memória. Quem administra a máquina, nós ou o Google, não tem como espiar essa memória.</dd></div>
                  <div><dt>Sem porta de entrada</dt><dd>Não existe SSH nem modo de depuração. A conexão segura (TLS) com o WhatsApp e com o seu assistente termina dentro da caixa, não num servidor no meio do caminho.</dd></div>
                  <div><dt>As chaves só saem para a imagem certa</dt><dd>A senha do banco, a chave da sessão do WhatsApp e a chave do TLS ficam num cofre do Google. Ele só as entrega a versões do programa cuja impressão digital (o digest) está numa lista pública no GitHub.</dd></div>
                  <div><dt>O banco guarda só conteúdo cifrado</dt><dd>Mensagens, nomes e arquivos ficam gravados cifrados (X25519 + AES-256-GCM), com uma chave por conta protegida pelo seu token. Uma cópia do banco não basta para ler o conteúdo.</dd></div>
                </dl>
              </div>

              <div className="site-transparency-panel site-audit-panel">
                <h3>Como qualquer pessoa confere</h3>
                <ol className="site-audit-steps">
                  <li><span>01</span><div><strong>Leia o código e reconstrua a imagem</strong><p>O build é reproduzível: o mesmo commit gera sempre o mesmo digest, em qualquer computador. Compare o seu com o do CI.</p><a href={`${repositoryUrl}#imagem-do-worker-reproduzível`} className="site-text-link" target="_blank" rel="noopener noreferrer">Como reconstruir <Arrow diagonal /></a></div></li>
                  <li><span>02</span><div><strong>Veja a lista pública de imagens confiadas</strong><p>Todo digest que já recebeu as chaves está num arquivo do repositório, com data. Nada entra sem ficar no histórico.</p><a href={`${repositoryUrl}/tree/main/infra/gcp/allowed-digests`} className="site-text-link" target="_blank" rel="noopener noreferrer">Ver a lista <Arrow diagonal /></a></div></li>
                  <li><span>03</span><div><strong>Peça a prova ao servidor</strong><p>Na página Segurança, seu navegador manda um número aleatório, recebe o atestado assinado pelo Google e compara o digest com a lista.</p><Link href="/seguranca#versao" className="site-text-link">Conferir agora <Arrow /></Link></div></li>
                </ol>
                <p className="site-transparency-note">Commit e imagem do serviço hospedado: <a href={transparencyUrl} className="underline underline-offset-2">consultar</a>. A página <Link href="/seguranca" className="underline underline-offset-2">Segurança e transparência</Link> explica o que essa verificação prova e o que não prova.</p>
              </div>
            </div>

            <div className="site-audit-footer">
              <div className="site-audit-selfhost">
                <strong>Prefere não depender de nós? Suba você mesmo.</strong>
                <p>Web, worker e banco Postgres, com o passo a passo no README. Código público no GitHub, sob a licença Apache 2.0.</p>
                <a className="site-text-link" href={`${repositoryUrl}#rodando-localmente`} target="_blank" rel="noopener noreferrer">Rodar minha própria instância <Arrow diagonal /></a>
                <a className="site-text-link" href={repositoryUrl} target="_blank" rel="noopener noreferrer">Conheça o projeto no GitHub <Arrow diagonal /></a>
              </div>
              <aside className="site-audit-limits" aria-label="Limites dessa proteção">
                <strong>O que isso não cobre</strong>
                <ul>
                  <li>Metadados ficam de fora: números, horários e quem fala com quem não têm essa proteção.</li>
                  <li>A garantia depende do Confidential Space do Google e do hardware da AMD.</li>
                  <li>Podemos publicar uma imagem nova. Ela só recebe as chaves depois de entrar na lista pública, então qualquer pessoa vê e pode auditar.</li>
                  <li>O que vai para o seu assistente (Claude ou outro) fica com esse provedor, sob as regras dele.</li>
                </ul>
              </aside>
            </div>
          </div>
        </section>

        <section id="ferramentas" className="site-tool-section"><div className="site-container site-section site-tools-grid"><div><p className="site-eyebrow">04 / PARA QUEM INTEGRA</p><h2>Oito ferramentas.<br />Um protocolo aberto.</h2><p>O MCP permite que clientes compatíveis consultem dados e executem ações. O painel fornece o endereço do servidor e as instruções para configurar seu token.</p><Link className="site-text-link" href="/auth/sign-in">Acessar a configuração <Arrow diagonal /></Link></div><dl className="site-tool-list">{tools.map(([name, desc]) => <div key={name}><dt><code>{name}</code></dt><dd>{desc}</dd></div>)}</dl></div></section>

        <section id="perguntas" className="site-container site-section site-faq" aria-labelledby="perguntas-title"><div><p className="site-eyebrow">05 / ANTES DE CONECTAR</p><h2 id="perguntas-title">Perguntas<br />frequentes.</h2></div><div className="site-questions">{questions.map(item => <details key={item.q}><summary>{item.q}<span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div></section>

        <section className="site-cta"><div className="site-container"><p className="site-eyebrow">MALOTE / WHATSAPP VIA MCP</p><h2>Traga o contexto das conversas<br />para o seu próximo passo.</h2><Link className="site-button" href="/auth/sign-up">Criar minha conta <Arrow diagonal /></Link></div></section>
      </main>

      <footer className="site-container site-footer"><div className="site-footer-top"><Logo /><div className="site-footer-company"><p>Conexão entre seu WhatsApp<br />e assistentes compatíveis com MCP.</p><p>Operado pelo Malote<br />CNPJ 69.708.277/0001-70</p><a href="mailto:contato@coraassist.com">contato@coraassist.com</a></div><nav aria-label="Navegação do rodapé"><a href="#como-funciona">Como funciona</a><Link href="/seguranca">Segurança e transparência</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link><a href="mailto:contato@coraassist.com">Contato</a><Link href="/auth/sign-in">Acessar painel <Arrow diagonal /></Link></nav></div><div className="site-footer-bottom"><span>© {new Date().getFullYear()} Malote</span><p>Serviço independente. Sem afiliação com WhatsApp, Meta ou Anthropic.</p></div></footer>
    </div>
  );
}
