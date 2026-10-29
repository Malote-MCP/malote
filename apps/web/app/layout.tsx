import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz"] });

export const metadata: Metadata = {
  title: "Malote — WhatsApp conectado ao seu assistente via MCP",
  description: "Conecte seu WhatsApp ao Claude e a outros assistentes via MCP. Busque mensagens, recupere documentos e envie respostas com acesso gerenciado pelo painel.",
  openGraph: {
    title: "Malote — suas conversas e arquivos no seu assistente",
    description: "Conexão entre WhatsApp e assistentes via MCP. Conheça o produto, as ferramentas e os controles de acesso.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-paper text-ink">{children}</body>
    </html>
  );
}
