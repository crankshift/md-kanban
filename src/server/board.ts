import { z } from 'zod';

export const implementationStatuses = ['needs-triage', 'needs-info', 'ready-for-agent', 'ready-for-human', 'wontfix'] as const;
export const wayfindingStatuses = ['open', 'claimed', 'resolved'] as const;
export const implementationStatus = z.enum(implementationStatuses);
export const wayfindingStatus = z.enum(wayfindingStatuses);
export const wayfindingType = z.enum(['research', 'prototype', 'grilling', 'task']);
export type Workflow = 'implementation' | 'wayfinding';

export const issueSchema = z.object({
  id: z.string(), path: z.string(), location: z.string(), feature: z.string(), container: z.string(),
  number: z.string().nullable(), title: z.string(), status: z.string().nullable(),
  workflow: z.enum(['implementation', 'wayfinding']).nullable(), type: z.string().nullable(),
  dependencyText: z.string().nullable(), content: z.string().nullable(), revision: z.string().nullable(),
  diagnostics: z.array(z.string()),
});
export type Issue = z.infer<typeof issueSchema>;
export type IssueContext = Pick<Issue, 'path' | 'location' | 'feature' | 'container'>;
export const boardSchema = z.object({ issues: z.array(issueSchema), warnings: z.array(z.string()) });
export type BoardData = z.infer<typeof boardSchema>;

export const issueWriteSchema = z.object({
  path: z.string().min(1).max(4096).refine((path) =>
    !/[\\\x00-\x1f:]/.test(path) && path.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
  'Use a root-relative issue path.'),
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
});
export const statusChangeSchema = issueWriteSchema.extend({
  status: z.enum([...implementationStatuses, ...wayfindingStatuses]),
}).strict();
export type StatusChange = z.infer<typeof statusChangeSchema>;

export function compareIssues(a: Issue, b: Issue): number {
  return a.feature.localeCompare(b.feature) ||
    (a.number ?? '').localeCompare(b.number ?? '', 'en', { numeric: true }) ||
    a.location.localeCompare(b.location) || a.path.localeCompare(b.path);
}
