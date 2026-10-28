import Link from "next/link";
import { Logo } from "@/components/logo";

const steps = [
  {
    n: "1",
    title: "Crie sua conta",
    body: "Entre com o Google ou com e-mail e senha. Leva meio minuto.",
  },
  {
    n: "2",
    title: "Escaneie o QR code",
    body: "No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. O Malote vira um aparelho vinculado, como o WhatsApp Web.",
  },
  {
    n: "3",
    title: "Conecte no Claude",
    body: "Gere um token no painel e adicione o Malote como servidor MCP. Pronto: o seu Claude passa a enxergar o seu WhatsApp.",
  },
];

const tools = [
  { name: "list_chats", desc: "Lista conversas e grupos" },
  { name: "get_messages", desc: "Lê o histórico de uma conversa" },
  { name: "search_messages", desc: "Busca por texto em tudo" },
  { name: "search_contacts", desc: "Acha pessoas e grupos" },
  { name: "send_message", desc: "Envia texto (com resposta citada)" },
  { name: "send_file", desc: "Envia foto, vídeo, áudio ou documento" },
  { name: "download_media", desc: "Baixa a mídia de uma mensagem" },
  { name: "whatsapp_status", desc: "Mostra se está conectado" },
];

const prompts = [
  "Resume o que rolou no grupo da obra essa semana.",
  "Acha o PDF do contrato que o Rafael me mandou em agosto e me reenvia.",
  "Quem ainda não confirmou presença no grupo do churrasco?",
  "Responde a Ana dizendo que chego às 19h.",
];

const faq = [
  {
    q: "Vocês usam IA para ler minhas mensagens?",
    a: "Não. O Malote não tem IA própria. Ele só guarda suas conversas e expõe ferramentas via MCP. Quem lê e decide é o seu Claude, quando você pede.",
  },
  {
    q: "É o WhatsApp oficial?",
    a: "Não. O Malote se conecta como um aparelho vinculado (o mesmo mecanismo do WhatsApp Web), usando uma biblioteca não oficial. Isso viola os termos do WhatsApp e existe risco de a conta ser restringida. Use com consciência.",
  },
  {
    q: "Como vocês reduzem o risco de bloqueio?",
    a: "Limitamos envios (10 por minuto, 200 por dia), só enviamos para conversas que já existem, não marcamos mensagens como lidas e não ficamos “online” no seu lugar. Nada de envio em massa.",
  },
  {
    q: "Onde ficam meus dados?",
    a: "Em um banco Postgres em São Paulo. As credenciais da sessão do WhatsApp são criptografadas. Você pode desconectar a qualquer momento pelo painel ou pelo próprio celular.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/auth/sign-in" className="rounded-full px-4 py-2 text-ink-2 hover:text-ink">
            Entrar
          </Link>
          <Link href="/auth/sign-up" className="rounded-full bg-ink px-4 py-2 font-medium text-paper hover:bg-ink-2">
            Criar conta
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-moss" /> Servidor MCP para WhatsApp
            </p>
            <h1 className="font-display text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
              Seu WhatsApp, <em className="text-moss">dentro do Claude.</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
              O Malote conecta o seu WhatsApp pessoal ao seu Claude. Ele lê conversas, busca aquela mensagem perdida, baixa
              mídias e envia textos e arquivos por você — quando você pede.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth/sign-up"
                className="rounded-full bg-moss px-6 py-3 font-medium text-paper shadow-sm hover:bg-moss-2"
              >
                Conectar meu WhatsApp
              </Link>
              <a href="#como-funciona" className="rounded-full border border-line px-6 py-3 font-medium hover:bg-paper-2">
                Como funciona
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-white/60 p-5 shadow-[0_20px_60px_-30px_rgba(29,27,22,0.35)]">
            <div className="mb-4 flex items-center gap-2 text-xs text-ink-3">
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="ml-2">Claude</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-paper-2 px-4 py-3">
                Pega o vídeo que o Léo mandou no grupo da família ontem e me manda.
              </div>
              <div className="space-y-1.5 font-mono text-[12px] text-ink-3">
                <p>→ search_contacts(&quot;família&quot;)</p>
                <p>→ get_messages(grupo, since: ontem)</p>
                <p>→ download_media(msg 3EB0…)</p>
                <p>→ send_file(&quot;me&quot;, media_id)</p>
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3">
                Pronto! Enviei o vídeo do Léo (0:42) no seu chat “Você” no WhatsApp.
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="border-y border-line bg-paper-2/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Como funciona</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="rounded-2xl border border-line bg-paper p-6">
                  <div className="font-display text-3xl text-moss">{s.n}</div>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-2">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">O que o seu Claude ganha</h2>
            <p className="mt-4 leading-relaxed text-ink-2">
              Oito ferramentas MCP, prontas para Claude Code, Claude Desktop ou qualquer cliente MCP. O Malote não tem IA
              própria: ele só entrega as ferramentas. Quem pensa é o seu Claude.
            </p>
            <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white/50">
              {tools.map((t) => (
                <li key={t.name} className="flex items-center justify-between gap-4 px-5 py-3">
                  <code className="font-mono text-sm text-moss">{t.name}</code>
                  <span className="text-right text-sm text-ink-2">{t.desc}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Peça do seu jeito</h2>
            <div className="mt-8 space-y-3">
              {prompts.map((p) => (
                <div key={p} className="rounded-2xl rounded-br-md border border-line bg-white/70 px-5 py-4 text-ink-2">
                  “{p}”
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-ink text-paper">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Perguntas honestas</h2>
            <div className="mt-10 grid gap-8 md:grid-cols-2">
              {faq.map((f) => (
                <div key={f.q}>
                  <h3 className="font-semibold">{f.q}</h3>
                  <p className="mt-2 leading-relaxed text-paper/75">{f.a}</p>
                </div>
              ))}
            </div>
            <div className="mt-14">
              <Link
                href="/auth/sign-up"
                className="inline-block rounded-full bg-paper px-6 py-3 font-medium text-ink hover:bg-paper-2"
              >
                Começar agora
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-3 sm:px-6">
        <Logo />
        <p>Malote não é afiliado ao WhatsApp nem à Meta.</p>
      </footer>
    </div>
  );
}
