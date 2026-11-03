import Link from "next/link";
import type { ReactNode } from "react";
import { GitHubStar } from "@/components/github-star";
import { Logo } from "@/components/logo";
import type { LegalDocument } from "@/lib/legal/types";

const inline = "underline underline-offset-2";
const company = "Cora Assist Ltda · CNPJ 69.708.277/0001-70";

/** Turns e-mail addresses in the legal text into mailto links. */
function linkify(text: string): ReactNode[] {
  return text.split(/([\w.+-]+@[\w-]+\.[\w.]+)/g).map((part, i) =>
    i % 2 ? <a key={i} className={inline} href={`mailto:${part}`}>{part}</a> : part,
  );
}

/** "1.2. Text" → clause number apart from the text. */
function clause(text: string) {
  const m = text.match(/^(\d+\.\d+\.)\s*(.*)$/s);
  return m ? { n: m[1], body: m[2] } : { n: null, body: text };
}

/** Definition lists ("Term: description") get the term in bold. */
function item(text: string) {
  const m = text.match(/^([^:]{2,60}):\s(.*)$/s);
  return m ? <><strong>{m[1]}:</strong> {linkify(m[2])}</> : linkify(text);
}

export function LegalPage({ doc, eyebrow, lead, other }: { doc: LegalDocument; eyebrow: string; lead: string; other: { href: string; label: string } }) {
  return (
    <div className="malote-site">
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
          <p className="site-eyebrow">{eyebrow}</p>
          <p className="trust-status">{doc.updated}</p>
          <h1>{lead}</h1>
          <p>
            O Malote é operado pela {company}. Leia também a <Link className={inline} href={other.href}>{other.label}</Link>.
          </p>
        </div>

        <div className="trust-layout">
          <nav className="trust-toc" aria-label="Nesta página">
            <p className="site-eyebrow">NESTA PÁGINA</p>
            {doc.sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}><span>{s.number.padStart(2, "0")}</span>{s.title}</a>
            ))}
          </nav>

          <div className="trust-articles">
            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="trust-article" aria-labelledby={`${s.id}-title`}>
                <p className="site-eyebrow">{s.number.padStart(2, "0")}</p>
                <h2 id={`${s.id}-title`}>{s.title}</h2>
                {s.blocks.map((b, i) => {
                  if (b.type === "list") return <ul key={i}>{b.items.map((t, j) => <li key={j}>{item(t)}</li>)}</ul>;
                  const { n, body } = clause(b.text);
                  return <p key={i}>{n && <span className="text-ink-3">{n} </span>}{linkify(body)}</p>;
                })}
              </section>
            ))}
          </div>
        </div>
      </main>
      <footer className="site-container site-footer">
        <div className="site-footer-bottom">
          <span>Malote · {company}</span>
          <span>
            <Link href="/termos">Termos</Link> · <Link href="/privacidade">Privacidade</Link> · <Link href="/seguranca">Segurança</Link> ·{" "}
            <Link href="/">Voltar ao produto <span aria-hidden="true">↗</span></Link>
          </span>
          <GitHubStar />
        </div>
      </footer>
    </div>
  );
}
