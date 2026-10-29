import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { GitHubStar } from "@/components/github-star";
import { repositoryUrl } from "@/lib/public-info";

export const metadata: Metadata = {
  title: "Termos de Uso — Malote",
  description: "Condições de uso do serviço hospedado do Malote: responsabilidades, uso aceitável, riscos da integração não oficial com o WhatsApp e limites do serviço.",
};

const contact = "luvi.germanos@coraassist.com";
const inline = "underline underline-offset-2";

const contents = [
  ["servico", "O serviço"],
  ["conta", "Conta e token"],
  ["responsabilidades", "Suas responsabilidades"],
  ["uso-aceitavel", "Uso aceitável"],
  ["riscos", "Integração não oficial"],
  ["disponibilidade", "Disponibilidade e responsabilidade"],
  ["suspensao", "Suspensão e encerramento"],
  ["geral", "Código aberto, alterações e foro"],
] as const;

export default function Terms() {
  return (
    <div className="malote-site">
      <GitHubStar />
      <a href="#conteudo" className="site-skip">Pular para o conteúdo</a>
      <header className="site-header">
        <div className="site-container site-header-inner">
          <Logo />
          <nav className="site-nav" aria-label="Navegação principal">
            <Link className="site-nav-section" href="/#demo">O produto</Link>
            <Link className="site-nav-section" href="/seguranca">Segurança e transparência</Link>
            <Link className="site-login" href="/auth/sign-in">Entrar <span aria-hidden="true">↗</span></Link>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="site-container trust-page">
        <div className="trust-hero">
          <p className="site-eyebrow">MALOTE / TERMOS DE USO</p>
          <p className="trust-status">Versão inicial — em revisão jurídica · 29/10/2026</p>
          <h1>Termos de uso.<br /><span>As regras do serviço hospedado.</span></h1>
          <p>Estes termos regem o uso do Malote em malote.io, operado pela L&amp;P Soluções, CNPJ 63.030.646/0001-31. Ao criar uma conta ou usar o serviço, você declara que leu e aceita estes termos e a <Link className={inline} href="/privacidade">Política de Privacidade</Link>.</p>
          <div className="trust-summary">
            <p><strong>Seu WhatsApp, seu assistente</strong><span>Você responde pelo uso</span></p>
            <p><strong>Sem envio em massa</strong><span>Só conversas existentes, com limites</span></p>
            <p><strong>Integração não oficial</strong><span>Risco de restrição pelo WhatsApp</span></p>
          </div>
        </div>

        <div className="trust-layout">
          <nav className="trust-toc" aria-label="Nesta página">
            <p className="site-eyebrow">NESTA PÁGINA</p>
            {contents.map(([id, label], i) => <a key={id} href={`#${id}`}><span>0{i + 1}</span>{label}</a>)}
            <a href={`mailto:${contact}`}>Fale com o responsável <span aria-hidden="true">↗</span></a>
          </nav>

          <div className="trust-articles">
            <section id="servico" className="trust-article" aria-labelledby="service-title">
              <p className="site-eyebrow">01 / O SERVIÇO</p>
              <h2 id="service-title">O que o Malote faz.</h2>
              <p>O Malote é um servidor MCP hospedado. Você vincula o seu WhatsApp pessoal lendo um QR code, como um aparelho conectado que roda nos nossos servidores, e gera um token para conectar o seu próprio assistente compatível com MCP, como Claude Code ou Claude Desktop. Pelas ferramentas do Malote, o assistente pode ler conversas, buscar mensagens, baixar mídias e enviar mensagens e arquivos em seu nome.</p>
              <p>O Malote não tem inteligência artificial própria e não decide o que fazer: ele executa o que o assistente conectado pede. O assistente é um serviço de terceiros, contratado diretamente por você e sujeito aos termos do respectivo provedor.</p>
              <p className="trust-note">O Malote é um serviço independente, sem afiliação com WhatsApp, Meta ou Anthropic.</p>
            </section>

            <section id="conta" className="trust-article" aria-labelledby="account-title">
              <p className="site-eyebrow">02 / CONTA E TOKEN</p>
              <h2 id="account-title">Sua conta e seu token.</h2>
              <ul>
                <li><strong>Idade:</strong> o serviço é destinado a maiores de 18 anos.</li>
                <li><strong>Dados corretos:</strong> mantenha seu e-mail de cadastro atualizado; ele é usado para confirmar sua identidade em pedidos de suporte e de dados.</li>
                <li><strong>Seu próprio WhatsApp:</strong> vincule apenas uma conta de WhatsApp que seja sua ou que você esteja autorizado a usar.</li>
                <li><strong>Token como senha:</strong> o token MCP dá acesso de leitura e de envio à sua conta. Não o compartilhe. Se ele vazar, revogue-o no painel. Você responde pelas ações feitas com tokens da sua conta.</li>
                <li><strong>Perda de todos os tokens:</strong> como o histórico é cifrado com uma chave protegida pelos seus tokens, perder todos eles pode exigir reiniciar o histórico armazenado.</li>
              </ul>
            </section>

            <section id="responsabilidades" className="trust-article" aria-labelledby="duties-title">
              <p className="site-eyebrow">03 / SUAS RESPONSABILIDADES</p>
              <h2 id="duties-title">Você responde pelo conteúdo e pelo uso.</h2>
              <ul>
                <li><strong>Conteúdo:</strong> você é responsável pelas mensagens e arquivos enviados pela sua conta, inclusive os que o seu assistente enviar a seu pedido. Revise as ações do assistente antes de autorizá-las.</li>
                <li><strong>Dados de terceiros:</strong> suas conversas contêm dados de outras pessoas. Ao conectar o WhatsApp e repassar esse conteúdo a um assistente de IA, você deve ter base legítima para isso e respeitar a privacidade dos seus contatos, informando-os ou obtendo consentimento quando necessário.</li>
                <li><strong>Legislação:</strong> você deve usar o serviço em conformidade com a lei brasileira, incluindo a LGPD, e com os termos do WhatsApp e do provedor do seu assistente.</li>
                <li><strong>Uso pessoal:</strong> o Malote foi pensado para uso pessoal e para um assistente pessoal, não para atendimento automatizado, marketing ou operação de terceiros.</li>
              </ul>
            </section>

            <section id="uso-aceitavel" className="trust-article" aria-labelledby="aup-title">
              <p className="site-eyebrow">04 / USO ACEITÁVEL</p>
              <h2 id="aup-title">O que não é permitido.</h2>
              <ul>
                <li>enviar spam, mensagens em massa, correntes ou comunicações comerciais não solicitadas;</li>
                <li>assediar, ameaçar, enganar ou se passar por outra pessoa;</li>
                <li>enviar conteúdo ilegal, que viole direitos de terceiros ou que contenha código malicioso;</li>
                <li>coletar dados de outras pessoas para fins não autorizados por elas ou pela lei;</li>
                <li>tentar burlar os limites do serviço, acessar contas de outros usuários ou prejudicar a infraestrutura;</li>
                <li>revender ou disponibilizar o serviço a terceiros sem autorização.</li>
              </ul>
              <p>Para proteger você e o serviço, o Malote só envia mensagens para conversas que já existem no seu WhatsApp e aplica limites de frequência de envio (atualmente, por padrão, 10 envios por minuto e 200 por dia). Esses limites podem mudar a qualquer momento e não autorizam, por si só, qualquer volume de envio.</p>
            </section>

            <section id="riscos" className="trust-article" aria-labelledby="risk-title">
              <p className="site-eyebrow">05 / INTEGRAÇÃO NÃO OFICIAL</p>
              <h2 id="risk-title">O WhatsApp pode restringir sua conta.</h2>
              <p>O Malote se conecta ao WhatsApp por um cliente não oficial (a biblioteca de código aberto Baileys), funcionando como um aparelho vinculado. Essa forma de conexão não é autorizada nem suportada pelo WhatsApp ou pela Meta, e o uso de clientes não oficiais pode violar os termos do WhatsApp.</p>
              <p>O WhatsApp pode, a qualquer momento e a seu critério, desconectar a sessão, restringir ou banir a conta vinculada. Os limites do Malote reduzem esse risco, mas não o eliminam. Ao vincular sua conta, você declara entender e aceitar esse risco. Não nos responsabilizamos por restrições, bloqueios ou perda de acesso impostos pelo WhatsApp.</p>
              <p>Mudanças feitas pelo WhatsApp também podem interromper o funcionamento do serviço sem aviso prévio.</p>
            </section>

            <section id="disponibilidade" className="trust-article" aria-labelledby="availability-title">
              <p className="site-eyebrow">06 / DISPONIBILIDADE E RESPONSABILIDADE</p>
              <h2 id="availability-title">Sem garantia de disponibilidade.</h2>
              <p>O serviço é oferecido como está e conforme disponível. Não há acordo de nível de serviço (SLA): podem ocorrer interrupções, manutenções, perda de sincronização, atrasos ou falhas no envio e no download. Podemos alterar, limitar ou descontinuar funcionalidades.</p>
              <p>O Malote não substitui o aplicativo do WhatsApp nem deve ser usado como único meio para comunicações urgentes, críticas ou de emergência, nem como cópia de segurança das suas conversas.</p>
              <p>Na máxima extensão permitida pela legislação, inclusive o Código de Defesa do Consumidor, a L&amp;P Soluções não responde por: ações executadas pelo assistente que você conectou; conteúdo enviado pela sua conta; uso indevido do seu token; atos do WhatsApp, da Meta ou do provedor do seu assistente; e danos indiretos, lucros cessantes ou perda de oportunidades. Nada nestes termos limita direitos que a lei não permita afastar.</p>
            </section>

            <section id="suspensao" className="trust-article" aria-labelledby="suspension-title">
              <p className="site-eyebrow">07 / SUSPENSÃO E ENCERRAMENTO</p>
              <h2 id="suspension-title">Quando podemos suspender o acesso.</h2>
              <p>Podemos suspender ou encerrar sua conta, revogar tokens ou desconectar o WhatsApp vinculado se houver violação destes termos, uso abusivo, risco à segurança do serviço ou de terceiros, ou exigência legal. Sempre que possível e adequado, avisaremos antes ou logo depois, com o motivo.</p>
              <p>Você pode parar de usar o serviço a qualquer momento: revogue seus tokens, desconecte o WhatsApp no painel ou em Aparelhos conectados no app e peça a exclusão da conta e dos dados pelo e-mail <a className={inline} href={`mailto:${contact}`}>{contact}</a>. O tratamento dos dados após o encerramento segue a <Link className={inline} href="/privacidade">Política de Privacidade</Link>.</p>
            </section>

            <section id="geral" className="trust-article" aria-labelledby="general-title">
              <p className="site-eyebrow">08 / DISPOSIÇÕES GERAIS</p>
              <h2 id="general-title">Código aberto, alterações e foro.</h2>
              <dl className="trust-definition-list">
                <div><dt>Código aberto</dt><dd>O código-fonte do Malote está disponível em <a className={inline} href={repositoryUrl}>github.com/Malote-MCP/malote</a> sob a licença Apache 2.0, que rege o uso, a modificação e a distribuição do software. Estes termos regem apenas o serviço hospedado operado pela L&amp;P Soluções. Quem roda a própria instalação é responsável por ela.</dd></div>
                <div><dt>Alterações</dt><dd>Podemos atualizar estes termos. A data da versão fica no topo da página. Mudanças relevantes serão comunicadas pelo site ou por e-mail antes de entrarem em vigor, quando possível. Continuar usando o serviço depois disso significa aceitar a nova versão.</dd></div>
                <div><dt>Lei e foro</dt><dd>Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do domicílio do usuário, quando consumidor, ou, nos demais casos, o foro legalmente competente.</dd></div>
                <div><dt>Contato</dt><dd>L&amp;P Soluções, CNPJ 63.030.646/0001-31 · <a className={inline} href={`mailto:${contact}`}>{contact}</a> · <a className={inline} href="https://malote.io">malote.io</a></dd></div>
              </dl>
            </section>

            <section className="trust-contact" aria-labelledby="contact-title">
              <p className="site-eyebrow">CONTATO</p>
              <h2 id="contact-title">Dúvidas sobre estes termos.</h2>
              <p>Para dúvidas, suporte ou denúncias de abuso, fale com o responsável pelo Malote. Não envie senhas, tokens ou QR codes de conexão.</p>
              <a className="site-text-link" href={`mailto:${contact}`}>{contact} <span aria-hidden="true">↗</span></a>
            </section>
          </div>
        </div>
      </main>
      <footer className="site-container site-footer"><div className="site-footer-bottom"><span>Malote · L&amp;P Soluções · CNPJ 63.030.646/0001-31</span><span><Link href="/privacidade">Privacidade</Link> · <Link href="/seguranca">Segurança</Link> · <Link href="/">Voltar ao produto <span aria-hidden="true">↗</span></Link></span></div></footer>
    </div>
  );
}
