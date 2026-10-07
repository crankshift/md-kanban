import { Badge, Button, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { resolveDependencies, type Dependency } from '../server/dependencies.js';
import type { Issue } from '../server/board.js';

// Badges wrap so long labels stay inside narrow cards.
const badge = { size: 'xs', whiteSpace: 'normal' } as const;

export function DependencyIndicators({ dependencies }: { dependencies: Dependency[] }) {
  const count = (state: string) => dependencies.filter((entry) => entry.kind === 'linked' && entry.state === state).length;
  const attention = dependencies.filter((entry) => entry.kind !== 'linked' || entry.state === 'unknown').length;
  return <HStack gap="1" flexWrap="wrap" aria-label="Dependency indicators">
    {count('advisory') > 0 && <Badge {...badge}>{count('advisory')} advisory {count('advisory') === 1 ? 'dependency' : 'dependencies'}</Badge>}
    {count('blocked') > 0 && <Badge {...badge} colorPalette="yellow">{count('blocked')} unresolved {count('blocked') === 1 ? 'blocker' : 'blockers'}</Badge>}
    {count('resolved') > 0 && <Badge {...badge}>{count('resolved')} resolved {count('resolved') === 1 ? 'prerequisite' : 'prerequisites'}</Badge>}
    {attention > 0 && <Badge {...badge} colorPalette="yellow">{attention} dependency {attention === 1 ? 'reference needs' : 'references need'} attention</Badge>}
  </HStack>;
}

export function DependencyList({ issue, issues, onSelect }: { issue: Issue; issues: Issue[]; onSelect: (id: string) => void }) {
  const dependencies = resolveDependencies(issue, issues);
  return (
    <Stack as="section" aria-labelledby="dependencies-heading" gap="3" mt="5" pt="4" borderTopWidth="1px" minW="0">
      <Heading as="h3" id="dependencies-heading" size="sm">Dependencies</Heading>
      <Text fontSize="xs" color="fg.muted" lineHeight="1.6">
        {issue.workflow === 'wayfinding'
          ? 'Advisory: only valid wayfinding prerequisites in resolved stop blocking. Unknown prerequisites need attention.'
          : 'Advisory: triage readiness does not establish implementation completion.'}
      </Text>
      <Text fontFamily="mono" fontSize="xs" overflowWrap="anywhere">
        Blocked by: {issue.dependencyText ?? '(not specified)'}
      </Text>
      {dependencies.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">No dependencies listed.</Text>
      ) : (
        <Stack as="ul" aria-label="Dependencies" gap="4" listStyleType="none" m="0" p="0">
          {dependencies.map((dependency, index) => (
            <Stack as="li" key={index} gap="1" minW="0">
              {dependency.kind === 'linked' ? <>
                <Button variant="plain" size="sm" h="auto" justifyContent="start" textAlign="start"
                  whiteSpace="normal" overflowWrap="anywhere" onClick={() => onSelect(dependency.target.id)}>
                  #{dependency.target.number}: {dependency.target.title}
                </Button>
                <Text fontFamily="mono" fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                  {dependency.target.path}
                </Text>
                <Text fontSize="xs" lineHeight="1.6">
                  {dependency.state === 'advisory' ? `Advisory · ${dependency.target.status ?? 'status unavailable'} · completion unknown` :
                    dependency.state === 'blocked' ? `Unresolved blocker · ${dependency.target.status}` :
                    dependency.state === 'resolved' ? 'Resolved prerequisite · no longer blocks' : 'Unknown prerequisite state · completion cannot be determined'}
                </Text>
              </> : <>
                <Text fontSize="sm" fontWeight="semibold" overflowWrap="anywhere">
                  {dependency.reference || '(empty reference)'}
                </Text>
                <Text fontSize="xs" color="fg.muted" lineHeight="1.6">
                  {dependency.kind === 'missing' ? 'Missing issue in this feature/location.' :
                    dependency.kind === 'ambiguous' ? 'Ambiguous number; multiple issues in this feature/location.' : 'Unsupported dependency reference; expected an issue number with an optional title.'}
                </Text>
                {dependency.kind === 'ambiguous' && (
                  <Stack as="ul" gap="1" listStyleType="none" m="0" p="0">
                    {dependency.candidates.map((candidate) => (
                      <Text as="li" fontFamily="mono" fontSize="xs" color="fg.muted" overflowWrap="anywhere" key={candidate.id}>
                        {candidate.path}
                      </Text>
                    ))}
                  </Stack>
                )}
              </>}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
