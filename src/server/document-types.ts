import { z } from 'zod';

export const documentKinds = ['specification', 'map', 'adr', 'document'] as const;
export const propertySchema = z.object({
  key: z.string(), label: z.string(), value: z.string(), values: z.array(z.string()),
  source: z.enum(['frontmatter', 'leading']), raw: z.string(), valid: z.boolean(),
});
export type DocumentProperty = z.infer<typeof propertySchema>;
export const supportingDocumentSchema = z.object({
  path: z.string(), title: z.string(), kind: z.enum(documentKinds),
  feature: z.string().nullable(), location: z.string().nullable(),
  name: z.string(), folder: z.string(), content: z.string().nullable(),
  properties: z.array(propertySchema), diagnostics: z.array(z.string()),
});
export type SupportingDocument = z.infer<typeof supportingDocumentSchema>;
export const relationSchema = z.object({
  source: z.string(), target: z.string(), kind: z.enum(['link', 'dependency']),
  property: z.string().optional(),
});
export type DocumentRelation = z.infer<typeof relationSchema>;
export const documentListSchema = z.object({
  folder: z.string(), documents: z.array(supportingDocumentSchema),
  edges: z.array(relationSchema), warnings: z.array(z.string()),
});
export type DocumentList = z.infer<typeof documentListSchema>;

export const openedDocumentSchema = z.object({
  path: z.string(), title: z.string(), kind: z.enum(documentKinds), content: z.string(), body: z.string(),
  properties: z.array(propertySchema), diagnostics: z.array(z.string()),
});
export type OpenedDocument = z.infer<typeof openedDocumentSchema>;

export const documentLinkSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('available'), path: z.string(), fragment: z.string().nullable(), issue: z.boolean() }),
  z.object({ status: z.literal('unavailable'), reason: z.string() }),
]);
export type DocumentLink = z.infer<typeof documentLinkSchema>;
