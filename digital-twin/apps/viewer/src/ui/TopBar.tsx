import { useEffect, useState } from 'react';
import { selectors, useStore } from '../store';

export function TopBar() {
  const s = useStore();
  const project = s.bundle!.project;
  const tower = selectors.tower(s);
  const unit = selectors.unit(s);
  const [copied, setCopied] = useState(false);
  const [fs, setFs] = useState(false);
  useEffect(() => { const f = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);

  const crumbs: { label: string; go?: () => void }[] = [{ label: 'Site', go: s.level === 'site' ? undefined : s.goExterior }];
  if (tower) crumbs.push({ label: tower.name, go: s.level === 'tower' ? undefined : () => s.goTower(tower.id) });
  if (tower && s.floorNumber && s.level !== 'tower') crumbs.push({ label: `Floor ${s.floorNumber}`, go: s.level === 'floor' ? undefined : () => s.goFloor(tower.id, s.floorNumber!, false) });
  if (unit) crumbs.push({ label: `Unit ${unit.label}` });

  const copy = async () => {
    try { await navigator.clipboard.writeText(location.href.split('#')[0]!); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()).catch?.(() => {});

  return (
    <header className="topbar">
      <div className="title">
        <h1>{project.name}</h1>
        {project.location && <span>{project.location}</span>}
      </div>
      <nav className="crumbs" aria-label="Where you are">
        {crumbs.map((c, i) => (
          <span key={i}>{i > 0 && <i aria-hidden>›</i>}{c.go ? <button className="link" onClick={c.go}>{c.label}</button> : <b aria-current="location">{c.label}</b>}</span>
        ))}
      </nav>
      <div className="tools">
        {s.level !== 'site' && <button className="icon" onClick={s.up} title="Back (Esc)" aria-label="Go back">←</button>}
        <button className={`icon${s.night ? ' on' : ''}`} onClick={s.toggleNight} title="Day / night (N)" aria-pressed={s.night} aria-label="Toggle day and night">{s.night ? '🌙' : '☀️'}</button>
        <button className="icon hide-sm" onClick={copy} title="Copy share link" aria-label="Copy share link">{copied ? '✓' : '🔗'}</button>
        <button className="icon hide-sm" onClick={toggleFs} title="Fullscreen" aria-pressed={fs} aria-label="Toggle fullscreen">{fs ? '⤡' : '⤢'}</button>
        <button className="icon" onClick={() => s.setHelp(true)} title="Shortcuts (?)" aria-label="Help and shortcuts">?</button>
      </div>
    </header>
  );
}
