import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} aria-label="Malote — início" className="inline-flex shrink-0 items-center" style={{ mixBlendMode: "multiply" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/malote-logo.png" width={144} height={30} alt="" />
    </Link>
  );
}
