import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { repositoryUrl, transparencyUrl } from "@/lib/public-info";
import { EnclaveStatus } from "@/components/enclave-status";
import { GitHubStar } from "@/components/github-star";

// The enclave status reads ENCLAVE_URL at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Segurança, código e transparência — Malote",
  description: "Como o Malote protege o histórico armazenado, os limites de acesso e o código aberto sob Apache 2.0.",
};

const contents = [
  ["armazenamento", "Conteúdo e criptografia"],
  ["limites", "O que o servidor acessa"],
  ["acesso", "Tokens e revogação"],
  ["codigo-aberto", "Código aberto no GitHub"],
  ["versao", "Versão e proveniência"],
] as const;

export default function Security() {
  return (
    <div className="malote-site">
      <GitHubStar />
      <a href="#conteudo" className="site-skip">Pular para o conteúdo</a>
      <header className="site-header">
        <div className="site-container site-header-inner">
          <Logo />
          <nav className="site-nav" aria-label="Navegação principal">
            <Link className="site-nav-section" href="/#demo">O produto</Link>
            <a className="site-nav-section" href="#codigo-aberto">Código e transparência</a>
            <Link className="site-login" href="/auth/sign-in">Entrar <span aria-hidden="true">↗</span></Link>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="site-container trust-page">
        <div className="trust-hero">
          <p className="site-eyebrow">MALOTE / SEGURANÇA E TRANSPARÊNCIA</p>
          <h1>O que protegemos.<br /><span>O que você precisa saber.</span></h1>
          <p>O Malote conecta informações pessoais ao seu assistente. Aqui estão os mecanismos de proteção do histórico, os limites do serviço e o que já pode ser conferido publicamente.</p>
          <div className="trust-summary">
            <p><strong>Conteúdo cifrado</strong><span>Proteção no armazenamento</span></p>
            <p><strong>Acesso por token</strong><span>Revogação pelo painel</span></p>
            <p><strong>Código aberto</strong><span>GitHub · licença Apache 2.0</span></p>
          </div>
        </div>

        <div className="trust-layout">
          <nav className="trust-toc" aria-label="Nesta página">
            <p className="site-eyebrow">NESTA PÁGINA</p>
            {contents.map(([id, label], i) => <a key={id} href={`#${id}`}><span>0{i + 1}</span>{label}</a>)}
            <a href="mailto:luvi.germanos@coraassist.com">Fale com o responsável <span aria-hidden="true">↗</span></a>
          </nav>

          <div className="trust-articles">
            <section id="armazenamento" className="trust-article" aria-labelledby="storage-title">
              <p className="site-eyebrow">01 / ARMAZENAMENTO</p>
              <h2 id="storage-title">Criptografia para o conteúdo guardado.</h2>
              <p>O mecanismo atual cifra textos, legendas, nomes de contatos e conversas, informações de mídia e arquivos baixados ao gravá-los no histórico e no armazenamento de mídias. A proteção se aplica ao conteúdo gravado no formato cifrado; instalações com histórico antigo dependem da conclusão da migração desses dados.</p>
              <dl className="trust-definition-list">
                <div><dt>Chaves por conta</dt><dd>Um par de chaves X25519 identifica a conta. Chaves temporárias e HKDF-SHA256 derivam as chaves usadas para cifrar o conteúdo com AES-256-GCM.</dd></div>
                <div><dt>Chave privada protegida pelo token</dt><dd>A chave privada é armazenada cifrada com uma chave derivada do token MCP. Para consultar o histórico, o servidor recebe um token válido e abre o conteúdo em memória.</dd></div>
                <div><dt>Proteção contra acesso apenas ao banco</dt><dd>Uma cópia dos registros cifrados, sem os tokens e as chaves correspondentes, não é suficiente para ler esse conteúdo. Isso não significa que todos os dados, todas as cópias ou todas as etapas do serviço sejam inacessíveis ao operador.</dd></div>
              </dl>
              <p className="trust-note">A implementação inclui migração de histórico legado e testes de criptografia. A existência desses mecanismos não comprova, sozinha, que toda instalação ou registro em produção já tenha sido migrado.</p>
            </section>

            <section id="limites" className="trust-article" aria-labelledby="limits-title">
              <p className="site-eyebrow">02 / MODELO DE CONFIANÇA</p>
              <h2 id="limits-title">O serviço processa suas mensagens.</h2>
              <p>O WhatsApp vinculado roda nos nossos servidores. Eles recebem mensagens antes de cifrá-las, recebem seu token durante as consultas e processam conteúdo decifrado para responder ao assistente. O processo de sincronização também mantém temporariamente chaves de criptografia em memória.</p>
              <p>Portanto, esta proteção de armazenamento não é uma arquitetura de conhecimento zero nem criptografia de ponta a ponta entre o seu aparelho e o Claude. Um operador que alterasse deliberadamente o código poderia capturar informações durante o processamento.</p>
              <div className="trust-data-table">
                <h3>Dados que exigem atenção adicional</h3>
                <dl>
                  <div><dt>Metadados</dt><dd>Números de telefone, identificadores de conversas, horários, tipo e direção das mensagens. Arquivos também mantêm informações técnicas, como tamanho e tipo de mídia.</dd></div>
                  <div><dt>Sessão do WhatsApp</dt><dd>As credenciais são cifradas com uma chave controlada pelo servidor, que permite a reconexão automática. Essa proteção é diferente da chave vinculada ao token do histórico.</dd></div>
                  <div><dt>Fila de comandos</dt><dd>Envios e downloads podem manter conteúdo em texto claro durante o processamento. Os payloads são limpos ao concluir ou falhar, e há rotinas de limpeza. Falhas ou comandos presos podem prolongar a retenção; não prometemos um prazo máximo universal.</dd></div>
                  <div><dt>Seu assistente</dt><dd>Dados devolvidos pelas ferramentas são disponibilizados ao cliente MCP que você conecta. O tratamento posterior também depende do provedor desse assistente.</dd></div>
                </dl>
              </div>
            </section>

            <section id="acesso" className="trust-article" aria-labelledby="access-title">
              <p className="site-eyebrow">03 / ACESSO</p>
              <h2 id="access-title">Seu token é uma credencial sensível.</h2>
              <p>O banco guarda o hash SHA-256 do token, um prefixo de identificação e a chave privada cifrada por uma chave derivada dele. O token completo é entregue ao cliente na criação e recebido pelo servidor nas chamadas autenticadas. Guarde-o como uma senha.</p>
              <ul>
                <li><strong>Leitura e envio:</strong> o token dá acesso às ferramentas da conta. Não há uma permissão separada de somente leitura.</li>
                <li><strong>Revogação:</strong> o painel invalida o token e remove o envelope de chave associado no banco atual. Novas chamadas com esse token deixam de ser autenticadas.</li>
                <li><strong>Limite da revogação:</strong> ela não recolhe dados já consultados nem desfaz ações em andamento, e não apaga cópias ou backups. Também não equivale a excluir sua conta.</li>
                <li><strong>Perda de todos os tokens:</strong> sem outra credencial que abra a chave, a recuperação pelo fluxo atual exige uma nova chave e a reinicialização do histórico armazenado.</li>
                <li><strong>Desconexão:</strong> você pode encerrar o vínculo no painel ou em Aparelhos conectados no WhatsApp. Para dúvidas ou solicitações sobre seus dados, use o contato abaixo.</li>
              </ul>
              <p>O envio é limitado a conversas existentes e tem controles de frequência. A integração com o WhatsApp é não oficial, e esses controles não eliminam o risco de restrição ou bloqueio da conta.</p>
            </section>

            <section id="codigo-aberto" className="trust-article" aria-labelledby="source-title">
              <p className="site-eyebrow">04 / CÓDIGO ABERTO</p>
              <h2 id="source-title">Código aberto para você conferir.</h2>
              <div className="trust-project-status"><span className="trust-status trust-status-ready">Público · Apache 2.0</span><p><strong>Malote-MCP / malote.</strong> O código-fonte está disponível para consulta e contribuição no GitHub, sob a licença Apache 2.0.</p><a className="site-text-link" href={repositoryUrl} target="_blank" rel="noopener noreferrer">Ver o repositório e dar uma estrela <span aria-hidden="true">↗</span></a></div>
              <p>Você pode examinar a implementação, acompanhar mudanças e contribuir com o projeto. As condições de uso, modificação e distribuição estão descritas na licença publicada no repositório.</p>
              <p>A abertura do código permite revisão, mas não substitui uma análise de segurança e não prova, por si só, que um servidor execute exatamente aquela versão. São garantias diferentes.</p>
            </section>

            <section id="versao" className="trust-article" aria-labelledby="version-title">
              <p className="site-eyebrow">05 / VERSÃO E PROVENIÊNCIA</p>
              <h2 id="version-title">Veja a versão informada pelos servidores.</h2>
              <EnclaveStatus enclaveUrl={process.env.ENCLAVE_URL ?? null} env={process.env.ENCLAVE_ENV ?? null} />
              <p>O endpoint público de transparência informa o commit e a referência da imagem do site, além das versões dos processos de WhatsApp que enviaram um sinal de atividade recente. Os componentes podem estar em versões diferentes durante uma atualização. Campos sem configuração podem aparecer como <code>null</code>.</p>
              <a href={transparencyUrl} className="trust-endpoint"><code>GET /api/transparency</code><span>Consultar serviço hospedado <span aria-hidden="true">↗</span></span></a>
              <p>Essas informações são declaradas pela própria infraestrutura. Elas ajudam a acompanhar mudanças, mas não são uma atestação independente do código em execução.</p>
              <h3>O que estamos preparando no fluxo de publicação</h3>
              <p>O workflow está configurado para gerar imagens a partir de um commit, produzir atestados de proveniência e implantar imagens pelo digest. Isso descreve o fluxo implementado no projeto; não comprova que toda versão já tenha um atestado acessível e verificável publicamente.</p>
              <p>Com as fontes públicas, você já pode revisar a implementação. Para conferir a origem de uma imagem específica, também é necessário ter acesso ao artefato e ao seu atestado de proveniência. Mesmo um atestado válido vincula o artefato ao processo de build; ele não prova sozinho o que está rodando dentro de uma máquina.</p>
            </section>

            <section className="trust-contact" aria-labelledby="contact-title">
              <p className="site-eyebrow">CONTATO</p>
              <h2 id="contact-title">Pergunte antes de conectar.</h2>
              <p>Para suporte ou solicitações sobre seus dados, fale com o responsável pelo Malote. Não envie senhas, tokens ou QR codes de conexão.</p>
              <a className="site-text-link" href="mailto:luvi.germanos@coraassist.com">luvi.germanos@coraassist.com <span aria-hidden="true">↗</span></a>
            </section>
          </div>
        </div>
      </main>
      <footer className="site-container site-footer"><div className="site-footer-bottom"><span>Malote · L&amp;P Soluções · CNPJ 63.030.646/0001-31</span><span><Link href="/privacidade">Privacidade</Link> · <Link href="/termos">Termos de uso</Link> · <Link href="/">Voltar ao produto <span aria-hidden="true">↗</span></Link></span></div></footer>
    </div>
  );
}
