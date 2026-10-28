import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-ink">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect x="3" y="9" width="26" height="19" rx="4" fill="#2f5d46" />
        <path d="M3 13l13 8 13-8" stroke="#f6f2ea" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <path d="M11 9V7a5 5 0 0 1 10 0v2" stroke="#2f5d46" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight">Malote</span>
    </Link>
  );
}
