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

export const titleSchema = z.string().min(1).max(500).refine((title) =>
  title.trim() === title && !/[\x00-\x1f\x7f]/.test(title), 'Enter a nonempty, single-line title without surrounding whitespace.');
export const issueChangesSchema = z.object({
  title: titleSchema.optional(),
  status: z.enum([...implementationStatuses, ...wayfindingStatuses]).optional(),
  dependencies: z.array(issueWriteSchema.shape.path).max(500).refine((paths) => new Set(paths).size === paths.length, 'Do not repeat dependencies.').optional(),
  body: z.string().max(500_000).refine((body) => !body.includes('\0'), 'Remove null characters from the body.').optional(),
}).strict().refine((changes) => Object.keys(changes).length > 0, 'Choose a field to change.');
export const issueEditSchema = issueWriteSchema.extend({ changes: issueChangesSchema }).strict();
export type IssueChanges = z.infer<typeof issueChangesSchema>;
export const commentSchema = z.string().max(100_000).refine((comment) => !!comment.trim() && !comment.includes('\0'), 'Enter a nonempty comment without null characters.');
export const commentAppendSchema = issueWriteSchema.extend({ comment: commentSchema }).strict();

export function compareIssues(a: Issue, b: Issue): number {
  return a.feature.localeCompare(b.feature) ||
    (a.number ?? '').localeCompare(b.number ?? '', 'en', { numeric: true }) ||
    a.location.localeCompare(b.location) || a.path.localeCompare(b.path);
}
