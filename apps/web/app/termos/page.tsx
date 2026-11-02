import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { termos } from "@/lib/legal/termos";

export const metadata: Metadata = {
  title: "Termos de Uso — Malote",
  description: "Termos de Uso do Malote: conta e tokens, uso permitido, integração não oficial com o WhatsApp, responsabilidades e encerramento.",
};

export default function Terms() {
  return <LegalPage doc={termos} eyebrow="MALOTE / TERMOS DE USO" lead="Termos de Uso." other={{ href: "/privacidade", label: "Política de Privacidade" }} />;
}
