export type LegalBlock = { type: "p"; text: string } | { type: "list"; items: string[] };
export type LegalSection = { id: string; number: string; title: string; blocks: LegalBlock[] };
export type LegalDocument = { title: string; updated: string; sections: LegalSection[] };
