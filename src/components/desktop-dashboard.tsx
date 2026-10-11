import { useEffect, useRef, useState } from 'react';
import { BatteryCharging, Battery, Cpu, MemoryStick, Clock, Pause, Play, SkipBack, SkipForward, Volume2, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DesktopState, SystemStats } from '@/lib/island-model';

const gb = (n: number) => `${(n / 1024 ** 3).toFixed(1)} GB`;
const hours = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

export function DesktopDashboard({ onNotice }: { onNotice: (m: string) => void }) {
 const [stats, setStats] = useState<SystemStats | null>(null);
 const [sys, setSys] = useState<DesktopState>({});
 const [volume, setVolume] = useState<number | null>(null); const dragging = useRef<string | null>(null);
 useEffect(() => {
  const bridge = window.islandDesktop; if (!bridge) return;
  return bridge.onSystem(s => { if (s.stats) setStats(s.stats); const { stats: _s, ...rest } = s; setSys(prev => ({ ...prev, ...rest })); if (typeof s.volume === 'number' && dragging.current !== 'Volume') setVolume(s.volume); });
 }, []);
 async function act(name: string, value?: number) {
  const r = await window.islandDesktop?.action(name, value);
  if (r && !r.ok) onNotice(r.error || 'That action did not work.');
 }
 const memPct = stats ? Math.round((stats.memUsed / stats.memTotal) * 100) : 0;
 return <section className="dashboard" aria-label="Live dashboard">
  <div className="preferences-heading"><h2>Dashboard</h2><span><span className="live-dot" /> Live from {stats?.host ?? 'this computer'}</span></div>
  <div className="dash-grid">
   <div className="dash-card now-playing">
    <span className="dash-label"><Volume2 size={13} /> Now playing {sys.source ? `· ${sys.source}` : ''}</span>
    <strong>{sys.title || 'Nothing playing'}</strong><p>{sys.artist || 'Start a song in Spotify or Music (Mac) or any player (Windows).'}</p>
    <div className="dash-controls">
     <Button variant="outline" size="icon" aria-label="Previous track" onClick={() => act('previous')}><SkipBack /></Button>
     <Button size="icon" aria-label="Play or pause" onClick={() => act('playPause')}>{sys.playing ? <Pause /> : <Play />}</Button>
     <Button variant="outline" size="icon" aria-label="Next track" onClick={() => act('next')}><SkipForward /></Button>
    </div>
    <div className="tuning-label"><label htmlFor="dash-volume">Volume</label><span>{volume ?? '—'}%</span></div>
    <input id="dash-volume" className="island-range" type="range" min="0" max="100" value={volume ?? 50} aria-label="Volume" onPointerDown={() => { dragging.current = 'Volume'; }} onKeyDown={() => { dragging.current = 'Volume'; }} onChange={e => setVolume(Number(e.target.value))} onPointerUp={e => { if (dragging.current !== 'Volume') return; dragging.current = null; act('volume', Number((e.target as HTMLInputElement).value)); }} onPointerCancel={e => { dragging.current = null; }} onKeyUp={e => { if (dragging.current !== 'Volume') return; dragging.current = null; act('volume', Number((e.target as HTMLInputElement).value)); }} onBlur={() => { dragging.current = null; }} />
   </div>
   <Stat icon={<Cpu size={15} />} label="CPU" value={stats ? `${stats.cpu}%` : '—'} detail={stats ? `${stats.cores} cores · ${stats.cpuModel}` : ''} pct={stats?.cpu} />
   <Stat icon={<MemoryStick size={15} />} label="Memory" value={stats ? `${memPct}%` : '—'} detail={stats ? `${gb(stats.memUsed)} of ${gb(stats.memTotal)}` : ''} pct={memPct} />
   <Stat icon={sys.charging ? <BatteryCharging size={15} /> : <Battery size={15} />} label="Battery" value={typeof sys.battery === 'number' ? `${sys.battery}%` : 'No battery'} detail={typeof sys.battery === 'number' ? (sys.charging ? 'Charging' : 'On battery') : ''} pct={sys.battery} />
   <Stat icon={<Clock size={15} />} label="Uptime" value={stats ? hours(stats.uptime) : '—'} detail="Since last restart" />
   <Stat icon={<Laptop size={15} />} label="System" value={stats?.os ?? '—'} detail={stats ? stats.arch : ''} />
  </div>
 </section>;
}
function Stat({ icon, label, value, detail, pct }: { icon: React.ReactNode; label: string; value: string; detail: string; pct?: number | undefined }) {
 return <div className="dash-card"><span className="dash-label">{icon} {label}</span><strong>{value}</strong><p>{detail}</p>{typeof pct === 'number' && <div className="dash-bar"><i style={{ width: `${pct}%` }} /></div>}</div>;
}
