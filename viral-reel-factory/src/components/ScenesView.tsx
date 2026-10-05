import { reelToText } from '../../shared/export';
import type { Reel, Scene } from '../../shared/types';
import { pad2, timeRange } from '../../shared/util';
import { Badge, Button, CopyButton, Section } from './ui';

function PromptBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="prompt">
      <div className="prompt-head">
        <span>{title}</span>
        <CopyButton text={text} label={`COPY ${title}`} />
      </div>
      <pre>{text}</pre>
    </div>
  );
}

function SceneCard({ s, n }: { s: Scene; n: number }) {
  const rows: [string, string][] = [['Purpose', s.purpose], ['Visual', s.visual], ['Action', s.action], ['Camera', s.camera], ['Lighting', s.lighting], ['Sound', s.sound], ['On-screen text', s.onScreenText], ['Voiceover', s.voiceover]];
  return (
    <article className="scene" data-testid="scene">
      <div className="scene-head">
        <h3>SCENE {pad2(n)}</h3>
        <Badge tone={s.beat === 'TURN' || s.beat === 'COLD OPEN' ? 'fire' : 'default'}>{s.beat}</Badge>
        <span className="scene-time">Time: {timeRange(s.start, s.end)}</span>
      </div>
      <dl className="scene-grid">
        {rows.map(([k, v]) => <div key={k} className="kv"><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <div className="prompts">
        <PromptBox title="IMAGE PROMPT" text={s.imagePrompt} />
        <PromptBox title="VIDEO PROMPT" text={s.videoPrompt} />
      </div>
    </article>
  );
}

export function ScenesView({ reel, onStronger, busy }: { reel: Reel; onStronger: () => void; busy: boolean }) {
  const hook = reel.hooks?.find((h) => h.id === reel.selectedHookId);
  const scenes = reel.scenes ?? [];
  return (
    <Section
      id="scenes"
      step="04"
      title="YOUR REEL"
      aside={<div className="row wrap">{reel.version > 1 && <Badge tone="fire">v{reel.version} · stronger</Badge>}<CopyButton text={reelToText(reel)} label="COPY ALL" variant="soft" size="md" /><Button variant="fire" onClick={onStronger} loading={busy}>🔥 MAKE IT STRONGER</Button></div>}
    >
      <div className="result-top">
        <div className="kv"><dt>REEL CONCEPT</dt><dd>{reel.analysis?.concept}</dd></div>
        {hook && <div className="kv"><dt>SELECTED HOOK</dt><dd>{hook.hook}{hook.onScreenText && <span className="muted"> · On screen: “{hook.onScreenText}”</span>}</dd></div>}
        {reel.story && <div className="kv"><dt>STORY</dt><dd>{reel.story.summary}</dd></div>}
      </div>
      <h3 className="scenes-title">SCENES <span className="muted small">{scenes.length} scenes · {reel.settings.duration} sec · {reel.settings.format} · {reel.settings.style}</span></h3>
      <div className="scenes">{scenes.map((s, i) => <SceneCard key={s.id} s={s} n={i + 1} />)}</div>
    </Section>
  );
}
