import { documentLinkSchema, type DocumentLink } from '../../server/document-types.js';

async function fetchJson(url: string): Promise<{ ok: boolean; value: unknown }> {
  const response = await fetch(url);
  return { ok: response.ok, value: (await response.json()) as unknown };
}
const errorOf = (value: unknown, fallback: string): string =>
  typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
    ? value.error
    : fallback;

/** Resolves a relative link from its source document. Failures are reported as unavailable, never as a guess. */
export async function resolveLink(from: string, href: string): Promise<DocumentLink> {
  try {
    const { ok, value } = await fetchJson(
      `/api/document-link?${new URLSearchParams({ from, href })}`,
    );
    if (!ok)
      return { status: 'unavailable', reason: errorOf(value, 'The link could not be resolved.') };
    return documentLinkSchema.parse(value);
  } catch {
    return {
      status: 'unavailable',
      reason: 'The link could not be resolved. Check the local server and try again.',
    };
  }
}
