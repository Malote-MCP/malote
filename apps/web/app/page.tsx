import Link from "next/link";
import { Logo } from "@/components/logo";
import { ProductDemo } from "@/components/product-demo";
import { repositoryUrl, transparencyUrl } from "@/lib/public-info";
import { GitHubStar } from "@/components/github-star";

const capabilities = [
  { n: "01", title: "Encontre o que ficou na conversa.", body: "Busque mensagens, contatos e grupos. Consulte o histórico disponível para recuperar um prazo, uma decisão ou uma informação.", example: "Encontre o prazo de entrega que a Ana passou no grupo do projeto." },
  { n: "02", title: "Recupere o arquivo certo.", body: "Localize e baixe fotos, vídeos, áudios e documentos recebidos. Reenvie arquivos para uma conversa existente ou para você mesmo.", example: "Ache o PDF da proposta que o Rafael enviou e me reenvie." },
  { n: "03", title: "Dê continuidade ao trabalho.", body: "Use o contexto das mensagens para preparar resumos e respostas no seu assistente. O Malote oferece as ferramentas de consulta e envio.", example: "Leia as mensagens do projeto e organize as pendências da semana." },
];

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
  { q: "Como falo com o responsável pelo serviço?", a: "Para suporte, dúvidas sobre o serviço ou solicitações relacionadas aos seus dados, escreva para luvi.germanos@coraassist.com. Informe o e-mail da sua conta e descreva a solicitação. Não envie senhas, tokens ou códigos de conexão." },
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
          <nav className="site-nav" aria-label="Navegação principal">
            <a className="site-nav-section" href="#produto">O produto</a>
            <a className="site-nav-section" href="#como-funciona">Como funciona</a>
            <a className="site-nav-section" href="#seguranca">Segurança</a>
            <a className="site-nav-section" href="#codigo">Código e transparência</a>
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

        <section id="produto" className="site-container site-section" aria-labelledby="produto-title">
          <div className="site-section-heading"><p className="site-eyebrow">01 / O PRODUTO</p><h2 id="produto-title">O que chega pelo WhatsApp<br />também faz parte do trabalho.</h2><p>Propostas, decisões e arquivos ficam espalhados em conversas. O Malote torna esse conteúdo acessível às ferramentas que você já usa.</p></div>
          <div className="site-capabilities">{capabilities.map(item => <article key={item.n}><span className="site-index">{item.n} /</span><h3>{item.title}</h3><p>{item.body}</p><blockquote><span>UM PEDIDO POSSÍVEL</span>“{item.example}”</blockquote></article>)}</div>
        </section>

        <section id="como-funciona" className="site-connection" aria-labelledby="conexao-title"><div className="site-container site-section">
          <div className="site-section-heading"><p className="site-eyebrow">02 / A CONEXÃO</p><h2 id="conexao-title">Do celular ao assistente,<br />em três etapas.</h2><p>Você precisa de uma conta de WhatsApp e de um cliente compatível com MCP. A configuração da conexão fica no painel.</p></div>
          <ol className="site-steps">{steps.map((step, i) => <li key={step.title}><span className="site-step-number">0{i + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
          <div className="site-protocol"><p><strong>Uma ponte entre ferramentas.</strong> O Malote sincroniza e disponibiliza o conteúdo. Seu assistente interpreta o pedido e escolhe quais ferramentas usar.</p><span>WhatsApp <Arrow /> Malote <Arrow /> MCP</span></div>
        </div></section>


        <section id="seguranca" className="site-container site-section site-security" aria-labelledby="seguranca-title">
          <div className="site-security-intro">
            <p className="site-eyebrow">03 / ACESSO E SEGURANÇA</p>
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
          <div className="site-container site-section site-transparency-grid">
            <div>
              <p className="site-eyebrow">04 / CÓDIGO E TRANSPARÊNCIA</p>
              <h2 id="codigo-title">O que já pode<br />ser conferido.</h2>
              <p>O código do Malote é público no GitHub, sob a licença Apache 2.0. Consulte a implementação, acompanhe as mudanças e contribua. Você também pode consultar a versão informada pelos servidores.</p>
              <a className="site-text-link" href={repositoryUrl} target="_blank" rel="noopener noreferrer">Conheça o projeto no GitHub <Arrow diagonal /></a>
            </div>
            <div className="site-transparency-panel">
              <div className="site-transparency-row"><div><strong>Proteção do histórico</strong><p>Mecanismo de criptografia e revogação de tokens.</p></div><span className="trust-status trust-status-ready">Implementado</span></div>
              <div className="site-transparency-row"><div><strong>Versão do serviço hospedado</strong><p>Commit e imagem declarados pela infraestrutura.</p></div><a href={transparencyUrl} className="site-text-link">Consultar <Arrow diagonal /></a></div>
              <div className="site-transparency-row"><div><strong>Código aberto no GitHub</strong><p>Repositório público · licença Apache 2.0.</p></div><a href={repositoryUrl} className="site-text-link" target="_blank" rel="noopener noreferrer">Ver código <Arrow diagonal /></a></div>
              <p className="site-transparency-note">Consultar uma versão não é auditar o código executado. O endpoint é uma declaração do próprio servidor; a verificação da origem de uma imagem também depende do atestado correspondente.</p>
            </div>
          </div>
        </section>

        <section id="ferramentas" className="site-tool-section"><div className="site-container site-section site-tools-grid"><div><p className="site-eyebrow">05 / PARA QUEM INTEGRA</p><h2>Oito ferramentas.<br />Um protocolo aberto.</h2><p>O MCP permite que clientes compatíveis consultem dados e executem ações. O painel fornece o endereço do servidor e as instruções para configurar seu token.</p><Link className="site-text-link" href="/auth/sign-in">Acessar a configuração <Arrow diagonal /></Link></div><dl className="site-tool-list">{tools.map(([name, desc]) => <div key={name}><dt><code>{name}</code></dt><dd>{desc}</dd></div>)}</dl></div></section>

        <section id="perguntas" className="site-container site-section site-faq" aria-labelledby="perguntas-title"><div><p className="site-eyebrow">06 / ANTES DE CONECTAR</p><h2 id="perguntas-title">Perguntas<br />frequentes.</h2></div><div className="site-questions">{questions.map(item => <details key={item.q}><summary>{item.q}<span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div></section>

        <section className="site-cta"><div className="site-container"><p className="site-eyebrow">MALOTE / WHATSAPP VIA MCP</p><h2>Traga o contexto das conversas<br />para o seu próximo passo.</h2><Link className="site-button" href="/auth/sign-up">Criar minha conta <Arrow diagonal /></Link></div></section>
      </main>

      <footer className="site-container site-footer"><div className="site-footer-top"><Logo /><div className="site-footer-company"><p>Conexão entre seu WhatsApp<br />e assistentes compatíveis com MCP.</p><p>Operado por L&amp;P Soluções<br />CNPJ 63.030.646/0001-31</p><a href="mailto:luvi.germanos@coraassist.com">luvi.germanos@coraassist.com</a></div><nav aria-label="Navegação do rodapé"><a href="#produto">Produto</a><Link href="/seguranca">Segurança e transparência</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link><a href="mailto:luvi.germanos@coraassist.com">Contato</a><Link href="/auth/sign-in">Acessar painel <Arrow diagonal /></Link></nav></div><div className="site-footer-bottom"><span>© {new Date().getFullYear()} Malote</span><p>Serviço independente. Sem afiliação com WhatsApp, Meta ou Anthropic.</p></div></footer>
    </div>
  );
}
