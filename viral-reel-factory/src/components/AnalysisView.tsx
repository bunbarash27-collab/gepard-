import type { IdeaAnalysis } from '../../shared/types';
import { useT } from '../lib/i18n';
import { Badge, Button, Section } from './ui';

const TONE = { strong: 'green', 'needs-work': 'amber', weak: 'red' } as const;

export function AnalysisView({ a, onUseImproved, busy }: { a: IdeaAnalysis; onUseImproved: (idea: string) => void; busy: boolean }) {
  const { t } = useT();
  const f = t.fields;
  const rows: [string, string][] = [
    [f.concept, a.concept],
    [f.mainCharacter, a.mainCharacter],
    [f.goal, a.goal],
    [f.conflict, a.conflict],
    [f.surprise, a.surprise],
    [f.emotionalDirection, a.emotionalDirection],
    [f.payoff, a.payoff],
  ];
  return (
    <Section
      id="analysis"
      step="01"
      title={t.analysisTitle}
      aside={
        <div className="row">
          <span className="muted small">{t.verdict}:</span><Badge tone={TONE[a.verdict]}>{t.verdicts[a.verdict]}</Badge>
          <span className="muted small">{t.score}:</span><span className="score" data-testid="score">{a.score}/10</span>
        </div>
      }
    >
      <dl className="analysis-grid">
        {rows.map(([k, val]) => <div key={k} className="kv"><dt>{k}</dt><dd>{val}</dd></div>)}
      </dl>
      <div className="critique">
        {a.strengths.length > 0 && <div><h4 className="ok-title">{t.strengths}</h4><ul>{a.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>}
        {a.weaknesses.length > 0 && <div><h4 className="warn-title">{t.weaknesses}</h4><ul data-testid="weaknesses">{a.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul></div>}
      </div>
      {a.improvedIdea && (
        <div className="improved" data-testid="improved-idea">
          <div><h4>{t.improved}</h4><p>{a.improvedIdea}</p></div>
          <Button variant="primary" onClick={() => onUseImproved(a.improvedIdea!)} disabled={busy}>{t.useImproved}</Button>
        </div>
      )}
    </Section>
  );
}
