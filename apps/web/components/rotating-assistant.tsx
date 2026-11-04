"use client";

import { useEffect, useState } from "react";

const names = ["Claude", "ChatGPT", "OpenClaw", "Hermes"];

export function RotatingAssistant() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      clearInterval(timer);
      if (!preference.matches && !document.hidden) {
        timer = setInterval(() => setActive(index => (index + 1) % names.length), 3500);
      }
    };
    sync();
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(timer);
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <>
      <span className="assistant-rotator" aria-hidden="true">
        {names.map((name, index) => <span key={name} data-active={active === index}>{name}.</span>)}
      </span>
      <span className="sr-only">Claude, ChatGPT, OpenClaw e Hermes.</span>
    </>
  );
}
