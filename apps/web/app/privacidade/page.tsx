import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { GitHubStar } from "@/components/github-star";
import { repositoryUrl } from "@/lib/public-info";

export const metadata: Metadata = {
  title: "Política de Privacidade — Malote",
  description: "Quais dados o Malote trata, por que, com quem compartilha, por quanto tempo guarda e como exercer seus direitos pela LGPD.",
};

const contact = "luvi.germanos@coraassist.com";

const contents = [
  ["controlador", "Quem é o controlador"],
  ["dados", "Dados que tratamos"],
  ["finalidades", "Finalidades e bases legais"],
  ["compartilhamento", "Compartilhamento e transferência"],
  ["seguranca", "Segurança e limites"],
  ["retencao", "Retenção e exclusão"],
  ["direitos", "Seus direitos"],
  ["outros", "Cookies, menores e alterações"],
] as const;

export default function Privacy() {
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
          <p className="site-eyebrow">MALOTE / POLÍTICA DE PRIVACIDADE</p>
          <p className="trust-status">Versão inicial — em revisão jurídica · 29/10/2026</p>
          <h1>Seus dados no Malote.<br /><span>O que tratamos e por quê.</span></h1>
          <p>Esta política explica como o Malote trata dados pessoais ao conectar o seu WhatsApp a um assistente compatível com MCP, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).</p>
          <div className="trust-summary">
            <p><strong>Conteúdo cifrado</strong><span>Mensagens e mídias guardadas cifradas</span></p>
            <p><strong>Sem IA própria</strong><span>Só o assistente que você conecta</span></p>
            <p><strong>Seus direitos</strong><span>Pedidos pelo e-mail do controlador</span></p>
          </div>
        </div>

        <div className="trust-layout">
          <nav className="trust-toc" aria-label="Nesta página">
            <p className="site-eyebrow">NESTA PÁGINA</p>
            {contents.map(([id, label], i) => <a key={id} href={`#${id}`}><span>0{i + 1}</span>{label}</a>)}
            <a href={`mailto:${contact}`}>Fale com o responsável <span aria-hidden="true">↗</span></a>
          </nav>

          <div className="trust-articles">
            <section id="controlador" className="trust-article" aria-labelledby="controller-title">
              <p className="site-eyebrow">01 / CONTROLADOR</p>
              <h2 id="controller-title">Quem é responsável pelos seus dados.</h2>
              <p>O Malote é um servidor MCP hospedado em <a className="underline underline-offset-2" href="https://malote.io">malote.io</a>. Você entra com sua conta, vincula o seu WhatsApp pessoal lendo um QR code e gera um token para conectar o seu próprio assistente (por exemplo, Claude Code ou Claude Desktop), que passa a poder ler conversas, buscar mensagens, baixar mídias e enviar mensagens e arquivos. O Malote não tem inteligência artificial própria.</p>
              <dl className="trust-definition-list">
                <div><dt>Controlador</dt><dd>L&amp;P Soluções, CNPJ 63.030.646/0001-31.</dd></div>
                <div><dt>Canal de contato e de privacidade</dt><dd><a className="underline underline-offset-2" href={`mailto:${contact}`}>{contact}</a>. Use este endereço para dúvidas, solicitações de titulares e comunicações sobre proteção de dados.</dd></div>
                <div><dt>Código-fonte</dt><dd>O software é aberto sob a licença Apache 2.0 em <a className="underline underline-offset-2" href={repositoryUrl}>github.com/Malote-MCP/malote</a>. Esta política trata do serviço hospedado operado pela L&amp;P Soluções, não de instalações feitas por terceiros a partir do código.</dd></div>
              </dl>
            </section>

            <section id="dados" className="trust-article" aria-labelledby="data-title">
              <p className="site-eyebrow">02 / DADOS</p>
              <h2 id="data-title">Dados que tratamos.</h2>
              <p>Tratamos apenas o necessário para autenticar você, manter o WhatsApp vinculado e responder às ferramentas usadas pelo seu assistente.</p>
              <dl className="trust-definition-list">
                <div><dt>Conta</dt><dd>Nome e e-mail, além de credenciais e sessões de login (incluindo endereço IP e identificação do navegador), mantidos pelo serviço de autenticação. Se você entrar com o Google, recebemos do Google os dados básicos do perfil necessários para o login.</dd></div>
                <div><dt>Sessão do WhatsApp</dt><dd>As credenciais do aparelho vinculado, guardadas cifradas com uma chave do servidor para permitir a reconexão automática, e o número de telefone e identificador da conta vinculada.</dd></div>
                <div><dt>Conversas, contatos e mensagens</dt><dd>Histórico sincronizado pelo WhatsApp e mensagens recebidas ou enviadas enquanto a conexão está ativa: textos, legendas, nomes de remetentes, conversas e contatos, informações de mídia e os arquivos de mídia que você ou o seu assistente baixarem. Isso inclui dados de pessoas que conversam com você.</dd></div>
                <div><dt>Metadados</dt><dd>Números de telefone e identificadores (JIDs) de conversas e remetentes, data e hora, tipo e direção das mensagens, e informações técnicas de arquivos, como tamanho e tipo.</dd></div>
                <div><dt>Tokens MCP</dt><dd>Guardamos o hash SHA-256 de cada token e um prefixo de identificação, nunca o token completo. O token é enviado ao servidor a cada chamada do assistente.</dd></div>
                <div><dt>Fila de comandos</dt><dd>Pedidos de envio e de download passam por uma fila interna. O conteúdo do pedido fica em texto claro enquanto é processado; ele é apagado ao concluir ou falhar, e os registros são excluídos minutos depois.</dd></div>
                <div><dt>Registros técnicos</dt><dd>Registros de acesso e de funcionamento gerados pela aplicação e pela infraestrutura, como endereço IP, data e hora e mensagens de erro.</dd></div>
              </dl>
              <p className="trust-note">Não vendemos dados pessoais, não usamos seu conteúdo para publicidade e não treinamos modelos de IA com ele.</p>
            </section>

            <section id="finalidades" className="trust-article" aria-labelledby="purposes-title">
              <p className="site-eyebrow">03 / FINALIDADES E BASES LEGAIS</p>
              <h2 id="purposes-title">Por que tratamos e com qual base legal.</h2>
              <div className="trust-data-table">
                <h3>Finalidades e bases da LGPD</h3>
                <dl>
                  <div><dt>Prestar o serviço que você contratou</dt><dd>Criar e autenticar sua conta, manter o WhatsApp vinculado, sincronizar e guardar o histórico e executar as ferramentas pedidas pelo seu assistente. Base: execução de contrato e de procedimentos preliminares (art. 7º, V).</dd></div>
                  <div><dt>Dados de pessoas que conversam com você</dt><dd>Tratados apenas para executar o serviço solicitado por você, sobre as suas próprias conversas. Base: execução do contrato com você e legítimo interesse, limitado ao estritamente necessário (art. 7º, V e IX).</dd></div>
                  <div><dt>Segurança, prevenção de abuso e suporte</dt><dd>Limitar envios, investigar falhas, proteger contas e responder a pedidos de suporte. Base: legítimo interesse (art. 7º, IX).</dd></div>
                  <div><dt>Obrigações legais e defesa de direitos</dt><dd>Guardar registros quando a lei exigir e atender autoridades. Base: cumprimento de obrigação legal ou regulatória e exercício regular de direitos (art. 7º, II e VI).</dd></div>
                  <div><dt>Recursos opcionais</dt><dd>Quando algum tratamento depender de escolha sua, como entrar com o Google, ele se apoia no seu consentimento (art. 7º, I), que pode ser revogado a qualquer momento.</dd></div>
                </dl>
              </div>
              <p>Mensagens podem conter dados pessoais sensíveis (como saúde, religião ou opinião política) por iniciativa de quem escreve. Não buscamos nem classificamos esse tipo de dado; ele é tratado apenas como parte do conteúdo que você pede ao serviço para guardar e entregar ao seu assistente.</p>
            </section>

            <section id="compartilhamento" className="trust-article" aria-labelledby="sharing-title">
              <p className="site-eyebrow">04 / COMPARTILHAMENTO</p>
              <h2 id="sharing-title">Com quem os dados são compartilhados.</h2>
              <p>Usamos fornecedores que tratam dados em nosso nome (operadores) ou que fazem parte do fluxo que você escolheu. Os fornecedores atuais incluem:</p>
              <dl className="trust-definition-list">
                <div><dt>Banco de dados e autenticação</dt><dd>Neon, que hospeda o banco de dados Postgres e o serviço de login, em região da AWS em São Paulo (Brasil).</dd></div>
                <div><dt>Hospedagem da aplicação</dt><dd>Provedores de infraestrutura como a Fly.io, empresa dos Estados Unidos, com servidores na região de São Paulo. A infraestrutura pode mudar de fornecedor; manteremos esta lista atualizada.</dd></div>
                <div><dt>Google</dt><dd>Somente se você optar por entrar com uma conta Google.</dd></div>
                <div><dt>WhatsApp (Meta)</dt><dd>A conexão é feita com os servidores do WhatsApp como um aparelho vinculado à sua conta. O WhatsApp trata esses dados conforme as próprias políticas.</dd></div>
                <div><dt>Seu assistente de IA</dt><dd>O provedor que você escolhe conectar (por exemplo, a Anthropic) recebe tudo o que as ferramentas devolvem, inclusive o conteúdo de mensagens e arquivos. Esse tratamento segue os termos e a política de privacidade desse provedor, que você contrata diretamente.</dd></div>
              </dl>
              <p>Também podemos compartilhar dados quando exigido por lei, ordem judicial ou autoridade competente, ou para proteger direitos, sempre no limite do necessário.</p>
              <h3>Transferência internacional</h3>
              <p>Os servidores atuais ficam no Brasil, mas alguns fornecedores são empresas estrangeiras, e o provedor do seu assistente pode tratar dados em outros países. Nesses casos, a transferência ocorre nas hipóteses do art. 33 da LGPD, como a execução do contrato a pedido do titular e garantias contratuais oferecidas por esses fornecedores.</p>
            </section>

            <section id="seguranca" className="trust-article" aria-labelledby="security-title">
              <p className="site-eyebrow">05 / SEGURANÇA</p>
              <h2 id="security-title">Como protegemos e o que não prometemos.</h2>
              <ul>
                <li><strong>Conteúdo cifrado no armazenamento:</strong> textos, legendas, nomes de remetentes, conversas e contatos, informações de mídia e arquivos baixados são cifrados com um par de chaves X25519 da sua conta. A chave privada só é guardada cifrada pelo seu token MCP.</li>
                <li><strong>Tokens:</strong> guardamos apenas o hash SHA-256 e um prefixo. Você pode revogar tokens pelo painel.</li>
                <li><strong>Sessão do WhatsApp:</strong> cifrada com uma chave mantida pelo servidor, para permitir a reconexão sem a sua presença.</li>
                <li><strong>Metadados em claro:</strong> números, identificadores, horários, tipo e direção das mensagens não são cifrados por essa chave.</li>
              </ul>
              <p>O servidor processa suas mensagens e recebe o seu token em memória para responder ao assistente. Por isso, o Malote não oferece criptografia de ponta a ponta nem arquitetura de conhecimento zero. Os detalhes estão na página de <Link className="underline underline-offset-2" href="/seguranca">segurança e transparência</Link>.</p>
              <p>Nenhum sistema é totalmente seguro. Em caso de incidente de segurança que possa gerar risco ou dano relevante, comunicaremos os titulares afetados e a Autoridade Nacional de Proteção de Dados (ANPD), conforme a LGPD.</p>
            </section>

            <section id="retencao" className="trust-article" aria-labelledby="retention-title">
              <p className="site-eyebrow">06 / RETENÇÃO</p>
              <h2 id="retention-title">Por quanto tempo guardamos.</h2>
              <ul>
                <li><strong>Conta e histórico:</strong> enquanto sua conta existir ou até você pedir a exclusão.</li>
                <li><strong>Desconectar o WhatsApp:</strong> apaga as credenciais da sessão vinculada, mas não apaga o histórico já armazenado.</li>
                <li><strong>Revogar um token:</strong> invalida o token e remove a chave cifrada associada a ele, mas não apaga dados, cópias nem backups.</li>
                <li><strong>Fila de comandos:</strong> o conteúdo é apagado ao concluir ou falhar, e os registros são excluídos minutos depois. Falhas podem prolongar esse prazo.</li>
                <li><strong>Backups:</strong> o provedor do banco mantém histórico e cópias de recuperação por uma janela limitada. Dados excluídos podem permanecer nessas cópias até que elas expirem.</li>
                <li><strong>Obrigações legais:</strong> alguns registros podem ser mantidos pelo prazo exigido em lei, como os registros de acesso a aplicações previstos no Marco Civil da Internet, ou para o exercício regular de direitos.</li>
              </ul>
              <p>Ainda não há exclusão de conta pelo painel. Para excluir sua conta e seus dados, escreva para <a className="underline underline-offset-2" href={`mailto:${contact}`}>{contact}</a> a partir do e-mail cadastrado.</p>
            </section>

            <section id="direitos" className="trust-article" aria-labelledby="rights-title">
              <p className="site-eyebrow">07 / SEUS DIREITOS</p>
              <h2 id="rights-title">Seus direitos como titular.</h2>
              <p>Pelo art. 18 da LGPD, você pode solicitar:</p>
              <ul>
                <li>confirmação de que tratamos seus dados e acesso a eles;</li>
                <li>correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei;</li>
                <li>portabilidade dos dados a outro fornecedor, observada a regulamentação;</li>
                <li>eliminação dos dados tratados com base no consentimento;</li>
                <li>informação sobre com quem compartilhamos seus dados;</li>
                <li>informação sobre a possibilidade de não consentir e suas consequências;</li>
                <li>revogação do consentimento;</li>
                <li>oposição a tratamentos feitos com base em outras hipóteses, em caso de descumprimento da lei.</li>
              </ul>
              <p>Para exercer esses direitos, escreva para <a className="underline underline-offset-2" href={`mailto:${contact}`}>{contact}</a>. Podemos pedir informações para confirmar sua identidade antes de atender. Responderemos nos prazos da LGPD. Você também pode apresentar reclamação à ANPD.</p>
              <p>Se você não é usuário do Malote, mas conversa com alguém que usa o serviço, também pode nos procurar. Como o histórico é cifrado com a chave do usuário, alguns pedidos dependerão da participação dele.</p>
            </section>

            <section id="outros" className="trust-article" aria-labelledby="other-title">
              <p className="site-eyebrow">08 / OUTROS PONTOS</p>
              <h2 id="other-title">Cookies, menores e alterações.</h2>
              <dl className="trust-definition-list">
                <div><dt>Cookies</dt><dd>Usamos apenas cookies necessários para manter você conectado e proteger o login. Não usamos cookies de publicidade nem ferramentas de análise de terceiros.</dd></div>
                <div><dt>Menores de idade</dt><dd>O Malote não se destina a menores de 18 anos. Se soubermos que uma conta pertence a um menor, poderemos encerrá-la e excluir os dados.</dd></div>
                <div><dt>Alterações</dt><dd>Podemos atualizar esta política. A data da versão fica no topo da página. Mudanças relevantes serão comunicadas pelo site ou por e-mail antes de entrarem em vigor, quando possível.</dd></div>
              </dl>
              <p>O uso do serviço também está sujeito aos <Link className="underline underline-offset-2" href="/termos">Termos de Uso</Link>.</p>
            </section>

            <section className="trust-contact" aria-labelledby="contact-title">
              <p className="site-eyebrow">CONTATO</p>
              <h2 id="contact-title">Dúvidas sobre privacidade.</h2>
              <p>Para dúvidas, pedidos de titulares ou exclusão de dados, fale com o responsável pelo Malote. Não envie senhas, tokens ou QR codes de conexão.</p>
              <a className="site-text-link" href={`mailto:${contact}`}>{contact} <span aria-hidden="true">↗</span></a>
            </section>
          </div>
        </div>
      </main>
      <footer className="site-container site-footer"><div className="site-footer-bottom"><span>Malote · L&amp;P Soluções · CNPJ 63.030.646/0001-31</span><span><Link href="/termos">Termos de uso</Link> · <Link href="/seguranca">Segurança</Link> · <Link href="/">Voltar ao produto <span aria-hidden="true">↗</span></Link></span></div></footer>
    </div>
  );
}
