"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const stages = ["Conectar o Malote", "Adicionar ao Claude", "Fazer perguntas"];
const examples = [
  { label: "Encontrar um arquivo", question: "Encontre a proposta que a Ana me mandou no WhatsApp.", tool: "Buscando nas mensagens · localizando documento", answer: "Encontrei na conversa com a Ana. Ela enviou a proposta na terça-feira, junto com o prazo para revisão.", file: true },
  { label: "Resumir um grupo", question: "O que ficou pendente no grupo do projeto?", tool: "Lendo as mensagens do grupo Projeto", answer: "Três pontos ficaram em aberto: revisar a proposta até quinta, confirmar a entrega com o fornecedor e enviar o contrato final para a Ana.", file: false },
  { label: "Preparar uma resposta", question: "Avise a Ana que vou revisar a proposta hoje.", tool: "Localizando o contato da Ana", answer: "Posso enviar: “Oi, Ana! Vou revisar a proposta hoje e te retorno.” Você confirma o envio?", file: false },
];
const durations = [1900, 1700, 2500, 1700, 2800, 1700, 1900, 1700, 4500, 1900, 1700, 4500, 1900, 1700, 4800];

function TypedText({ text, animate, paused }: { text: string; animate: boolean; paused: boolean }) {
  const [count, setCount] = useState(0);
  const cursor = useRef(0);
  useEffect(() => { cursor.current = 0; setCount(0); }, [text]);
  useEffect(() => {
    if (!animate || paused) return;
    const timer = window.setInterval(() => {
      cursor.current = Math.min(cursor.current + 3, text.length);
      setCount(cursor.current);
      if (cursor.current === text.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [text, animate, paused]);
  return <span><span className="sr-only">{text}</span><span aria-hidden="true">{animate && !paused ? text.slice(0, count) : text}</span></span>;
}

function IllustrativeQr() {
  return (
    <svg viewBox="0 0 29 29" role="img" aria-label="QR code ilustrativo, sem conexão real" className="demo-qr">
      <rect width="29" height="29" fill="white" />
      {[ [2, 2], [20, 2], [2, 20] ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="7" height="7" fill="currentColor" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="white" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="currentColor" />
        </g>
      ))}
      {Array.from({ length: 25 * 25 }, (_, i) => {
        const x = i % 25 + 2;
        const y = Math.floor(i / 25) + 2;
        if ((x < 10 && (y < 10 || y > 18)) || (x > 18 && y < 10)) return null;
        return (x * 13 + y * 7 + x * y) % 5 < 2
          ? <rect key={i} x={x} y={y} width="1" height="1" fill="currentColor" /> : null;
      })}
    </svg>
  );
}

export function ProductDemo() {
  const root = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [automatic, setAutomatic] = useState(true);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  const [motion, setMotion] = useState(false);
  const [manualQuestion, setManualQuestion] = useState(0);
  const [pending, setPending] = useState(false);
  const stage = frame < 4 ? 0 : frame < 6 ? 1 : 2;
  const question = automatic ? Math.max(0, Math.floor((frame - 6) / 3)) : manualQuestion;
  const example = examples[question];
  const phase = frame >= 6 ? (frame - 6) % 3 : 0;
  const running = playing && inView && visible;
  const paused = automatic && !running;
  const stageStart = [0, 4, 6][stage];
  const stageEnd = [4, 6, 15][stage];
  const stageDuration = durations.slice(stageStart, stageEnd).reduce((sum, duration) => sum + duration, 0);
  const completedDuration = durations.slice(stageStart, frame).reduce((sum, duration) => sum + duration, 0);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    function sync() { setMotion(!preference.matches); if (preference.matches) setPlaying(false); }
    sync();
    preference.addEventListener("change", sync);
    const observer = new IntersectionObserver(entries => setInView(entries[0].isIntersecting), { threshold: 0.2 });
    if (root.current) observer.observe(root.current);
    function visibility() { setVisible(!document.hidden); }
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); preference.removeEventListener("change", sync); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setFrame(n => (n + 1) % durations.length), durations[frame]);
    return () => window.clearTimeout(timer);
  }, [frame, running]);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(false), 800);
    return () => window.clearTimeout(timer);
  }, [pending, manualQuestion]);

  function jump(next: number) {
    setPlaying(false);
    setAutomatic(false);
    setPending(false);
    setFrame(next);
  }
  function ask(index: number) { jump(8); setManualQuestion(index); setPending(true); }
  function togglePlayback() {
    if (playing) { setPlaying(false); return; }
    if (!automatic) setFrame(stage === 2 ? 6 : stage === 1 ? 4 : 0);
    setAutomatic(true);
    setPending(false);
    setPlaying(true);
  }

  return (
    <div id="demo" ref={root} className="product-demo" role="region" aria-label="Demonstração do Malote" data-running={running} data-active={inView && visible} style={{ "--scene-duration": `${durations[frame]}ms`, "--step-from": completedDuration / stageDuration, "--step-to": (completedDuration + durations[frame]) / stageDuration } as CSSProperties}>
      <div className="demo-topbar"><span className="demo-topbar-title"><span className="demo-status-dot" />{stage === 2 ? "Claude + Malote" : "Seu espaço no Malote"}</span><span className="demo-label">DEMONSTRAÇÃO INTERATIVA</span></div>
      <div className="demo-canvas">
        <div className="demo-scene" key={stage}>
          {stage === 0 && <div className="demo-onboarding">
            <div className="demo-story"><span className="demo-kicker">01 / CONECTE SUA CONTA</span><h2>O começo de<br />uma boa conexão.</h2><p>Crie seu token no painel. Depois, vincule o WhatsApp pelo QR code do seu celular.</p><div className="demo-checklist"><span className={frame > 0 ? "is-done" : ""}><i>{frame > 0 ? "✓" : "1"}</i>Token de acesso</span><span className={frame === 3 ? "is-done" : ""}><i>{frame === 3 ? "✓" : "2"}</i>WhatsApp vinculado</span></div></div>
            <div className="demo-connection-visual" key={frame < 2 ? "token" : frame === 2 ? "qr" : "connected"}>
              {frame < 2 ? <div className="demo-token-panel"><div className="demo-app-icon" aria-hidden="true"><img src="/malote-mark.png" width={40} height={32} alt="" /></div><strong>Seu acesso começa aqui.</strong><span>Um token para conectar seu assistente.</span><div className="demo-token-value">{frame === 0 ? "Seu token aparecerá aqui" : "mlt_demo_••••••••••••••••"}</div><button type="button" onClick={() => jump(frame === 0 ? 1 : 2)}>{frame === 0 ? "Gerar token de exemplo" : "Vincular meu WhatsApp"}<span aria-hidden="true">→</span></button><small>Token fictício · sem acesso a uma conta</small></div> : frame === 2 ? <div className="demo-phone"><span>WhatsApp · Aparelhos conectados</span><IllustrativeQr /><strong>Aponte. Conecte. Pronto.</strong><p>QR ilustrativo, não escaneável.</p><button type="button" onClick={() => jump(3)}>Simular leitura <span aria-hidden="true">↗</span></button></div> : <div className="demo-connected"><div className="demo-orbit"><span>✓</span></div><strong>WhatsApp conectado.</strong><p>Suas conversas agora têm uma ponte.</p><button type="button" onClick={() => jump(4)}>Adicionar ao Claude <span aria-hidden="true">→</span></button></div>}
            </div>
          </div>}
          {stage === 1 && <div className="demo-onboarding">
            <div className="demo-story"><span className="demo-kicker">02 / ADICIONE AO CLAUDE</span><h2>Seu assistente.<br />Com mais contexto.</h2><p>Copie a configuração do painel para o seu cliente MCP. Aqui, um exemplo com o Claude Code.</p><div className="demo-client-tags"><span>Claude Code</span><span>Claude Desktop</span></div><button type="button" className="demo-subtle-action" onClick={() => jump(frame === 4 ? 5 : 8)}>{frame === 4 ? "Simular configuração" : "Fazer uma pergunta"}<span aria-hidden="true">→</span></button></div>
            <div className="demo-terminal"><div className="demo-terminal-bar"><span><i /><i /><i /></span>Claude Code</div><div className="demo-terminal-body"><span className="demo-terminal-comment"># Configuração ilustrativa</span><code><span>$ </span><TypedText text={'claude mcp add --transport http malote \\\n  https://seu-malote.example/api/mcp \\\n  --header "Authorization: Bearer TOKEN_DE_EXEMPLO"'} animate={motion} paused={paused} /></code>{frame === 5 && <div className="demo-terminal-success"><strong>✓ Malote conectado</strong><span>8 ferramentas disponíveis</span><div>Mensagens <span>Arquivos</span> Contatos</div></div>}</div><p>Use o endereço e o token reais do seu painel.</p></div>
          </div>}
          {stage === 2 && <div className="demo-conversation">
            <div className="demo-chat-context"><span className="demo-claude-mark" aria-hidden="true">✳</span><div><strong>Uma conversa com contexto.</strong><span>WhatsApp conectado pelo Malote</span></div><span className="demo-connected-label"><i />Conectado</span></div>
            <div className="demo-messages" key={question}>
              <div className="demo-chat-user"><span>Você</span><p><TypedText text={example.question} animate={motion} paused={paused} /></p></div>
              <div className="demo-chat-response" aria-busy={phase !== 2 || pending}><span className="demo-response-icon" aria-hidden="true">✳</span><div><strong>Claude <span>com Malote</span></strong>{phase >= 1 && <p className="demo-search-state"><span className={phase === 1 || pending ? "demo-search-dot" : ""}>{phase === 2 && !pending ? "✓" : ""}</span>{example.tool}</p>}{phase === 0 || pending ? <div className="demo-typing" aria-label="Preparando resposta"><i /><i /><i /></div> : phase === 2 && <div className="demo-answer"><p><TypedText text={example.answer} animate={motion} paused={paused} /></p>{example.file && <div className="demo-chat-file"><span aria-hidden="true">↓</span><div><strong>Proposta comercial.pdf</strong><span>Conversa com Ana · exemplo</span></div><span>PDF</span></div>}</div>}</div></div>
            </div>
            <div className="demo-question-options" aria-label="Perguntas de exemplo">{examples.map((item, i) => <button type="button" key={item.label} aria-pressed={question === i} onClick={() => ask(i)}>{item.label}<span aria-hidden="true">↗</span></button>)}</div>
          </div>}
        </div>
      </div>
      <div className="demo-timeline" aria-label="Etapas da demonstração">{stages.map((label, i) => <button type="button" key={label} onClick={() => { jump([0, 4, 8][i]); if (i === 2) setManualQuestion(0); }} aria-current={stage === i ? "step" : undefined}><span className="demo-timeline-number">0{i + 1}</span><span>{label}</span><i className={stage === i && automatic ? "is-running" : ""} key={stage === i ? frame : i} /></button>)}</div>
      <div className="demo-player-bar"><span>Conversas fictícias. Nenhum dado real é acessado.</span><div><button type="button" onClick={() => { jump(0); setManualQuestion(0); }} aria-label="Recomeçar demonstração">↺</button><button type="button" onClick={togglePlayback} aria-label={playing ? "Pausar demonstração" : "Reproduzir demonstração"} aria-pressed={playing}><span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span></button></div></div>
    </div>
  );
}
