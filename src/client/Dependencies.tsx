import { resolveDependencies, type Dependency } from '../server/dependencies.js';
import type { Issue } from '../server/board.js';

export function DependencyIndicators({ dependencies }: { dependencies: Dependency[] }) {
  const count = (state: string) => dependencies.filter((entry) => entry.kind === 'linked' && entry.state === state).length;
  const attention = dependencies.filter((entry) => entry.kind !== 'linked' || entry.state === 'unknown').length;
  return <div className="dependency-indicators">
    {count('advisory') > 0 && <span>{count('advisory')} advisory {count('advisory') === 1 ? 'dependency' : 'dependencies'}</span>}
    {count('blocked') > 0 && <span className="blocker">{count('blocked')} unresolved {count('blocked') === 1 ? 'blocker' : 'blockers'}</span>}
    {count('resolved') > 0 && <span>{count('resolved')} resolved {count('resolved') === 1 ? 'prerequisite' : 'prerequisites'}</span>}
    {attention > 0 && <span className="dependency-warning">{attention} dependency {attention === 1 ? 'reference needs' : 'references need'} attention</span>}
  </div>;
}

export function DependencyList({ issue, issues, onSelect }: { issue: Issue; issues: Issue[]; onSelect: (id: string) => void }) {
  const dependencies = resolveDependencies(issue, issues);
  return <section aria-labelledby="dependencies-heading">
    <h3 id="dependencies-heading">Dependencies</h3>
    <p className="muted">{issue.workflow === 'wayfinding'
      ? 'Advisory: only valid wayfinding prerequisites in resolved stop blocking. Unknown prerequisites need attention.'
      : 'Advisory: triage readiness does not establish implementation completion.'}</p>
    <p className="path">Blocked by: {issue.dependencyText ?? '(not specified)'}</p>
    {dependencies.length === 0 ? <p>No dependencies listed.</p> : <ul className="dependency-list">
      {dependencies.map((dependency, index) => <li key={index}>
        {dependency.kind === 'linked' ? <>
          <button className="text-link" onClick={() => onSelect(dependency.target.id)}>#{dependency.target.number}: {dependency.target.title}</button>
          <span className="path">{dependency.target.path}</span>
          <span>{dependency.state === 'advisory' ? `Advisory · ${dependency.target.status ?? 'status unavailable'} · completion unknown` :
            dependency.state === 'blocked' ? `Unresolved blocker · ${dependency.target.status}` :
            dependency.state === 'resolved' ? 'Resolved prerequisite · no longer blocks' : 'Unknown prerequisite state · completion cannot be determined'}</span>
        </> : <>
          <strong>{dependency.reference || '(empty reference)'}</strong>
          <span className="dependency-warning">{dependency.kind === 'missing' ? 'Missing issue in this feature/location.' :
            dependency.kind === 'ambiguous' ? 'Ambiguous number; multiple issues in this feature/location.' : 'Unsupported dependency reference; expected an issue number with an optional title.'}</span>
          {dependency.kind === 'ambiguous' && <ul>{dependency.candidates.map((candidate) => <li className="path" key={candidate.id}>{candidate.path}</li>)}</ul>}
        </>}
      </li>)}
    </ul>}
  </section>;
}
