import { z } from 'zod';

// Supporting documents are read-only context for issues. Their metadata (including an ADR's "Status:" line)
// is never parsed as issue metadata; only the title is read, so no document can become a card.
export const documentKinds = ['specification', 'map', 'adr'] as const;
export const supportingDocumentSchema = z.object({
  path: z.string(), title: z.string(), kind: z.enum(documentKinds),
  feature: z.string().nullable(), location: z.string().nullable(),
});
export type SupportingDocument = z.infer<typeof supportingDocumentSchema>;
export const documentListSchema = z.object({ documents: z.array(supportingDocumentSchema) });
export type DocumentList = z.infer<typeof documentListSchema>;

export const openedDocumentSchema = z.object({
  path: z.string(), title: z.string(), kind: z.enum([...documentKinds, 'document']),
  content: z.string(),
});
export type OpenedDocument = z.infer<typeof openedDocumentSchema>;

export const documentLinkSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('available'), path: z.string(), fragment: z.string().nullable(), issue: z.boolean() }),
  z.object({ status: z.literal('unavailable'), reason: z.string() }),
]);
export type DocumentLink = z.infer<typeof documentLinkSchema>;
