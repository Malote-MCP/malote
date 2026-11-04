import Link from "next/link";
import { Logo } from "@/components/logo";
import { RotatingAssistant } from "@/components/rotating-assistant";
import { ProductDemo } from "@/components/product-demo";
import { repositoryUrl } from "@/lib/public-info";
import { VerificationBadge } from "@/components/verification-badge";
import { GitHubStar } from "@/components/github-star";

const steps = [
  { title: "Crie sua conta", body: "Entre com Google ou e-mail e gere seu token no painel." },
  { title: "Conecte o WhatsApp", body: "Escaneie o QR code pelo celular, em Aparelhos conectados." },
  { title: "Adicione ao Claude", body: "Use o endereço MCP e o token. As instruções estão no painel." },
];

const tools = [
  ["list_chats", "Conversas e grupos"], ["get_messages", "Histórico de mensagens"],
  ["search_messages", "Busca por texto e período"], ["search_contacts", "Contatos e grupos por nome"],
  ["send_message", "Envio de texto e respostas"], ["send_file", "Envio de arquivos e mídias"],
  ["download_media", "Download de mídias recebidas"], ["whatsapp_status", "Estado da conexão"],
];

const questions = [
  { q: "É uma integração oficial do WhatsApp?", a: "Não. O Malote usa uma biblioteca não oficial para funcionar como aparelho vinculado. Não é afiliado ao WhatsApp, à Meta ou à Anthropic. O uso pode contrariar os termos do WhatsApp e resultar em bloqueio da conta." },
  { q: "O que fica armazenado?", a: "O histórico sincronizado e as mídias baixadas. Mensagens, nomes e arquivos no formato cifrado usam chaves por conta. Metadados e dados legados têm condições diferentes, descritas na página Segurança. O conteúdo consultado pelo seu assistente também segue as regras do provedor dele." },
  { q: "O assistente pode enviar mensagens?", a: "Sim. O token permite ler e enviar mensagens; não há modo somente leitura. A ferramenta orienta o assistente a confirmar envios, mas não existe aprovação obrigatória no painel. Você pode revogar o token ou desconectar o WhatsApp a qualquer momento." },
  { q: "Quanto custa?", a: "R$ 29,90 por mês ou R$ 299 por ano, com 15 dias de teste grátis sem cartão. O pagamento é feito por Pix ou cartão no Asaas. No cartão, a assinatura renova automaticamente e pode ser cancelada quando quiser; você usa até o fim do período pago. No Pix, você paga um mês ou um ano por vez, sem renovação automática." },
  { q: "E se eu perder todos os tokens?", a: "Guarde seu token como uma senha: ele também protege a chave do histórico. Sem uma credencial válida, é necessário criar outra chave e reinicializar o histórico armazenado. Não há recuperação dessa chave por e-mail." },
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}

export default function Landing() {
  return (
    <div className="malote-site">
      <a href="#conteudo" className="site-skip">Pular para o conteúdo</a>
      <header className="site-header">
        <div className="site-container site-header-inner">
          <Logo />
          <div className="site-header-badges"><VerificationBadge placement="header" /><GitHubStar /></div>
          <nav className="site-nav" aria-label="Navegação principal">
            <a className="site-nav-section" href="#como-funciona">Como funciona</a>
            <a className="site-nav-section" href="/seguranca">Segurança</a>
            <a className="site-nav-section" href="#preco">Preço</a>
            <a className="site-nav-section" href="#codigo">Código aberto</a>
            <Link className="site-login" href="/auth/sign-in">Entrar <Arrow diagonal /></Link>
          </nav>
        </div>
      </header>

      <main id="conteudo">
        <section className="site-container site-hero" aria-labelledby="hero-title">
          <div className="site-hero-copy">
            <p className="site-eyebrow"><span className="site-square" /> WHATSAPP CONECTADO AO SEU TRABALHO</p>
            <h1 id="hero-title">Seu WhatsApp.<br /><span className="site-hero-assistant-line">Dentro do <RotatingAssistant /></span></h1>
            <p className="site-lead">Busque mensagens, recupere arquivos e responda conversas sem sair do seu assistente. Conecte seu WhatsApp via MCP.</p>
            <div className="site-actions">
              <Link className="site-button" href="/auth/sign-up">Conectar meu WhatsApp <Arrow diagonal /></Link>
              <a className="site-text-link" href="#como-funciona">Como funciona <Arrow /></a>
            </div>
            <p className="site-hero-note">Funciona com Claude Desktop, Claude Code e clientes MCP.</p>
          </div>

          <ProductDemo />
        </section>

        <section id="como-funciona" className="site-connection" aria-labelledby="conexao-title"><div className="site-container site-section">
          <div className="site-section-heading"><p className="site-eyebrow">01 / A CONEXÃO</p><h2 id="conexao-title">Do celular ao assistente,<br />em três etapas.</h2></div>
          <ol className="site-steps">{steps.map((step, i) => <li key={step.title}><span className="site-step-number">0{i + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
          <div id="ferramentas" className="site-tool-catalogue" aria-labelledby="tools-title">
            <div className="site-tool-catalogue-heading"><h3 id="tools-title">O que seu assistente pode fazer</h3><span>{tools.length} ferramentas MCP</span></div>
            <dl className="site-tool-catalogue-grid">{tools.map(([name, desc]) => <div key={name}><dt>{desc}</dt><dd><code>{name}</code></dd></div>)}</dl>
          </div>
        </div></section>


        <section id="codigo" className="site-transparency" aria-labelledby="codigo-title">
          <div className="site-container site-section">
            <span id="seguranca" aria-hidden="true" />
            <div className="site-section-heading site-audit-heading">
              <p className="site-eyebrow">02 / CÓDIGO ABERTO</p>
              <h2 id="codigo-title">Código aberto.<br />Execução verificável.</h2>
              <p>O Malote roda em uma máquina confidencial. Confira a prova que liga o código no GitHub à imagem em execução.</p>
            </div>

            <figure className="audit-map" aria-labelledby="audit-map-title">
              <div className="audit-map-heading"><div><p className="site-eyebrow">ARQUITETURA / FLUXO DAS MENSAGENS</p><h3 id="audit-map-title">O caminho das suas mensagens.</h3></div><VerificationBadge placement="diagram" /></div>
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

            <div className="site-code-links"><a className="site-text-link" href={repositoryUrl} target="_blank" rel="noopener noreferrer">Código e instalação própria <Arrow diagonal /></a><Link className="site-text-link" href="/seguranca">Proteções, provas e limites <Arrow diagonal /></Link></div>
            <p className="site-code-note">O conteúdo armazenado é cifrado; metadados ficam de fora. A proteção do worker depende do Google Confidential Space e do hardware. O que chega ao seu assistente segue as regras do provedor dele.</p>
          </div>
        </section>

        <section id="preco" className="site-container site-section site-price-section" aria-labelledby="preco-title">
          <div className="site-section-heading"><p className="site-eyebrow">03 / PREÇO</p><h2 id="preco-title">Um plano só.<br />15 dias para testar.</h2><p>Tudo liberado desde o primeiro dia, sem cartão para começar. Pague com Pix ou cartão pelo Asaas e cancele quando quiser. Indicou alguém que conectou o WhatsApp? Você ganha mais 15 dias.</p></div>
          <div className="site-pricing">
            <div><span>Mensal</span><strong>R$ 29,90</strong><p>por mês</p></div>
            <div><span>Anual</span><strong>R$ 299</strong><p>por ano · 2 meses grátis</p></div>
            <Link className="site-button" href="/auth/sign-up">Começar o teste grátis <Arrow diagonal /></Link>
          </div>
        </section>

        <section id="perguntas" className="site-container site-section site-faq" aria-labelledby="perguntas-title"><div><p className="site-eyebrow">04 / ANTES DE CONECTAR</p><h2 id="perguntas-title">Perguntas<br />frequentes.</h2></div><div className="site-questions">{questions.map(item => <details key={item.q}><summary>{item.q}<span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div></section>

        <section className="site-cta"><div className="site-container"><div className="site-cta-inner"><div><p className="site-eyebrow">SEU WHATSAPP, COM MAIS CONTEXTO</p><h2>Pronto para conectar?</h2></div><Link className="site-button" href="/auth/sign-up">Criar minha conta <Arrow diagonal /></Link></div></div></section>
      </main>

      <footer className="site-container site-footer"><div className="site-footer-top"><Logo /><div className="site-footer-company"><p>Conexão entre seu WhatsApp<br />e assistentes compatíveis com MCP.</p><p>Operado pelo Malote<br />CNPJ 69.708.277/0001-70</p><a href="mailto:contato@coraassist.com">contato@coraassist.com</a></div><nav aria-label="Navegação do rodapé"><a href="#como-funciona">Como funciona</a><Link href="/seguranca">Segurança e transparência</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link><a href="mailto:contato@coraassist.com">Contato</a><Link href="/auth/sign-in">Acessar painel <Arrow diagonal /></Link></nav></div><div className="site-footer-bottom"><span>© {new Date().getFullYear()} Malote</span><p>Serviço independente. Sem afiliação com WhatsApp, Meta ou Anthropic.</p><GitHubStar /></div></footer>
    </div>
  );
}
