import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Segurança e transparência · Malote",
  description: "O que o Malote guarda, o que fica cifrado, o que não fica e como verificar o código que está rodando.",
};

const site = process.env.PUBLIC_URL ?? "https://malote-web.fly.dev";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-ink px-4 py-3 font-mono text-[12.5px] leading-relaxed text-paper">
      {children}
    </pre>
  );
}

export default function Seguranca() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-balance">Segurança e transparência</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          Resumo honesto: o histórico que o Malote guarda é cifrado com uma chave que só o seu token destrava. Quem opera
          o serviço não consegue ler o que está no banco. Mas o seu WhatsApp roda nos nossos servidores, então você
          precisa confiar em quem opera o serviço. Abaixo, o que isso significa.
        </p>

        <Section title="O que fica cifrado">
          <ul className="list-disc space-y-2 pl-5">
            <li>Texto das mensagens, legendas, nomes de quem enviou, informações de mídia.</li>
            <li>Nomes de conversas, grupos e contatos.</li>
            <li>Fotos, vídeos, áudios e documentos baixados.</li>
          </ul>
          <p>
            Cada conta tem um par de chaves X25519. O servidor guarda só a chave pública e cifra tudo para ela (AES-256-GCM
            com chaves efêmeras). A chave privada é guardada cifrada com o seu token MCP, e do token guardamos só o hash
            SHA-256. Sem o token, o banco é ilegível para nós, para o provedor do banco e para qualquer vazamento ou
            backup.
          </p>
        </Section>

        <Section title="O que não fica cifrado">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Metadados: números de telefone e identificadores das conversas, horário de cada mensagem, tipo (texto, foto…)
              e se foi enviada por você. Eles são necessários para listar e ordenar conversas.
            </li>
            <li>
              As credenciais da sessão do WhatsApp. Ficam cifradas com uma chave do servidor, porque o serviço precisa
              reconectar sozinho, sem você presente.
            </li>
          </ul>
        </Section>

        <Section title="O limite: o que você ainda precisa confiar">
          <p>
            Para funcionar, o servidor recebe cada mensagem nova do WhatsApp antes de cifrar, e recebe o seu token a cada
            chamada do Claude. Um operador mal-intencionado que alterasse o código poderia capturar essas informações. A
            criptografia impede o acesso casual ou por vazamento, mas não protege contra uma alteração deliberada do código.
          </p>
          <p>
            Se esse modelo de confiança não serve para você, não conecte. Um modo local, em que tudo roda na sua própria
            máquina e nada passa por nós, está nos planos.
          </p>
        </Section>

        <Section title="O que está rodando">
          <p>
            Os servidores informam a versão (commit) e a imagem em execução, e qualquer troca de versão aparece aqui:
          </p>
          <Code>{`curl ${site}/api/transparency`}</Code>
          <p>
            Importante: o código-fonte do Malote não é público hoje, e esse endpoint é informado pelos próprios servidores.
            Ele mostra quando a versão muda, mas não permite que você confira, por conta própria, o que essa versão faz.
            Se você precisa dessa garantia, o Malote ainda não é para você.
          </p>
        </Section>

        <Section title="Você no controle">
          <ul className="list-disc space-y-2 pl-5">
            <li>Desconecte a qualquer momento pelo painel ou pelo WhatsApp (Aparelhos conectados).</li>
            <li>Revogar todos os tokens torna o histórico guardado ilegível para sempre.</li>
            <li>Comandos de envio e download são apagados logo após a execução.</li>
          </ul>
        </Section>
      </main>
    </div>
  );
}
