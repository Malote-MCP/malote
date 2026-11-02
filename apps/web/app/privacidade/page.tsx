import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { privacidade } from "@/lib/legal/privacidade";

export const metadata: Metadata = {
  title: "Política de Privacidade — Malote",
  description: "Como o Malote trata dados pessoais: o que é coletado, criptografia por conta, Clientes MCP, compartilhamento, retenção e direitos dos titulares.",
};

export default function Privacy() {
  return <LegalPage doc={privacidade} eyebrow="MALOTE / POLÍTICA DE PRIVACIDADE" lead="Política de Privacidade." other={{ href: "/termos", label: "Termos de Uso" }} />;
}
