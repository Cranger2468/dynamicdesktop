import { useEffect, useRef, useState } from 'react';
import { convert } from '@/lib/convert';

type Tab = 'Clipboard' | 'Notes' | 'Convert' | 'AI fix' | 'Ambient';
const tabs: Tab[] = ['Clipboard', 'Notes', 'Convert', 'AI fix', 'Ambient'];
const fixes = ['Rewrite professionally', 'Summarize to 2 bullets', 'Translate to Spanish', 'Fix grammar'];
const sounds = ['Rain', 'Coffee shop', 'White noise', 'Ocean waves'] as const;
const ENDPOINT = 'https://dynamicdesktop.lovable.app/api/public/assistant';

function useStored<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  useEffect(() => { try { const s = localStorage.getItem(key); if (s) setV(JSON.parse(s)); } catch { /* ignore */ } }, [key]);
  const set = (n: T) => { setV(n); localStorage.setItem(key, JSON.stringify(n)); };
  return [v, set] as const;
}

export function IslandToolkit({ onNotice }: { onNotice: (s: string) => void }) {
  const [tab, setTab] = useState<Tab>('Clipboard');
  const [clips, setClips] = useState<string[]>([]);
  const [note, setNote] = useStored('island-note', '');
  const [todos, setTodos] = useStored<{ t: string; d: boolean }[]>('island-todos', []);
  const [todo, setTodo] = useState('');
  const [query, setQuery] = useState('100 EUR in USD');
  const [fixText, setFixText] = useState('');
  const [fixOut, setFixOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState<string | null>(null);
  const audio = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);
  const bridge = typeof window !== 'undefined' ? window.islandDesktop : undefined;

  useEffect(() => { if (!bridge?.onClipboard) return; bridge.clipboard?.().then(setClips).catch(() => {}); return bridge.onClipboard(setClips); }, [bridge]);
  useEffect(() => () => audio.current?.stop(), []);

  async function copy(text: string) { await bridge?.copy?.(text); onNotice('Copied — paste it anywhere.'); }

  async function runFix(kind: string) {
    const text = fixText.trim() || clips[0] || '';
    if (!text) { onNotice('Copy or paste some text first.'); return; }
    setBusy(true); setFixOut('');
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'fix', question: kind, text }) });
      const reply = String((await res.json()).reply ?? '');
      if (!reply) throw new Error('empty');
      setFixOut(reply);
    } catch { setFixOut('The AI could not be reached. Check your internet connection.'); }
    setBusy(false);
  }

  function play(name: string) {
    audio.current?.stop(); audio.current = null;
    if (sound === name) { setSound(null); return; }
    const ctx = new AudioContext();
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = name === 'White noise' ? w : (last + 0.02 * w) / 1.02; d[i] = name === 'White noise' ? w * 0.25 : last * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = name === 'Rain' ? 4000 : name === 'Coffee shop' ? 1200 : name === 'Ocean waves' ? 600 : 12000;
    const gain = ctx.createGain(); gain.gain.value = 0.35;
    if (name === 'Ocean waves') { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.3; lfo.connect(lg).connect(gain.gain); lfo.start(); }
    src.connect(filter).connect(gain).connect(ctx.destination); src.start();
    audio.current = { ctx, stop: () => { src.stop(); void ctx.close(); } };
    setSound(name);
  }

  const result = convert(query);
  return <section className="toolkit" aria-label="Island tools">
    <div className="toolkit-tabs" role="tablist">{tabs.map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
    {tab === 'Clipboard' && <div className="toolkit-body">{clips.length ? clips.map((c, i) => <button key={i} className="clip" onClick={() => copy(c)}>{/^#[0-9a-f]{3,8}$/i.test(c.trim()) && <span className="swatch" style={{ background: c.trim() }} />}<span>{c.slice(0, 140)}</span></button>) : <p className="muted">Copy something and it will show up here. Click an item to copy it again.</p>}</div>}
    {tab === 'Notes' && <div className="toolkit-body"><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Scratchpad — phone numbers, snippets, anything." rows={4} />
      <form onSubmit={e => { e.preventDefault(); if (todo.trim()) { setTodos([...todos, { t: todo.trim(), d: false }]); setTodo(''); } }}><input value={todo} onChange={e => setTodo(e.target.value)} placeholder="Add a todo and press Enter" /></form>
      {todos.map((t, i) => <label key={i} className="todo"><input type="checkbox" checked={t.d} onChange={() => setTodos(todos.map((x, j) => j === i ? { ...x, d: !x.d } : x))} /><span className={t.d ? 'done' : ''}>{t.t}</span><button aria-label="Remove todo" onClick={() => setTodos(todos.filter((_, j) => j !== i))}>×</button></label>)}</div>}
    {tab === 'Convert' && <div className="toolkit-body"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="100 EUR in USD · 5 km in mi · 4pm London in Tokyo" /><p className="answer">{result ?? 'Try “100 EUR in USD”, “72 F in C”, or “4pm London in Tokyo”.'}</p></div>}
    {tab === 'AI fix' && <div className="toolkit-body"><textarea value={fixText} onChange={e => setFixText(e.target.value)} placeholder="Paste text here, or leave empty to use your last copied text." rows={3} />
      <div className="chips">{fixes.map(f => <button key={f} disabled={busy} onClick={() => runFix(f)}>{f}</button>)}</div>
      {busy && <p className="muted">Thinking…</p>}{fixOut && <><p className="answer">{fixOut}</p><button onClick={() => copy(fixOut)}>Copy result</button></>}</div>}
    {tab === 'Ambient' && <div className="toolkit-body chips">{sounds.map(s => <button key={s} className={sound === s ? 'active' : ''} onClick={() => play(s)}>{sound === s ? '❚❚ ' : '▶ '}{s}</button>)}</div>}
  </section>;
}
