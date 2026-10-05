import type { IdeaAnalysis } from '../../shared/types';
import { Badge, Button, Section } from './ui';

const VERDICT = { strong: { tone: 'green', text: 'Strong idea' }, 'needs-work': { tone: 'amber', text: 'Needs work' }, weak: { tone: 'red', text: 'Weak idea' } } as const;

export function AnalysisView({ a, onUseImproved, busy }: { a: IdeaAnalysis; onUseImproved: (idea: string) => void; busy: boolean }) {
  const v = VERDICT[a.verdict];
  const rows: [string, string][] = [
    ['Concept', a.concept],
    ['Main character', a.mainCharacter],
    ['Goal', a.goal],
    ['Conflict', a.conflict],
    ['Surprise', a.surprise],
    ['Emotional direction', a.emotionalDirection],
    ['Ending / Payoff', a.payoff],
  ];
  return (
    <Section id="analysis" step="01" title="IDEA ANALYSIS" aside={<div className="row"><Badge tone={v.tone}>{v.text}</Badge><span className="score" data-testid="score">{a.score}/10</span></div>}>
      <dl className="analysis-grid">
        {rows.map(([k, val]) => <div key={k} className="kv"><dt>{k}</dt><dd>{val}</dd></div>)}
      </dl>
      <div className="critique">
        {a.strengths.length > 0 && <div><h4 className="ok-title">What works</h4><ul>{a.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>}
        {a.weaknesses.length > 0 && <div><h4 className="warn-title">What's weak</h4><ul data-testid="weaknesses">{a.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul></div>}
      </div>
      {a.improvedIdea && (
        <div className="improved" data-testid="improved-idea">
          <div><h4>Improved version</h4><p>{a.improvedIdea}</p></div>
          <Button variant="primary" onClick={() => onUseImproved(a.improvedIdea!)} disabled={busy}>Use improved idea</Button>
        </div>
      )}
    </Section>
  );
}
