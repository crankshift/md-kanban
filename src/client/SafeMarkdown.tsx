import { Prose } from './components/ui/prose';
import { useEffect, useId, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type LinkKind = 'fragment' | 'external' | 'local';

/** Absolute and scheme URLs leave the app; `#section` stays in this document; everything else is a local document link. */
export function classifyLink(href: string): LinkKind {
  if (href.startsWith('#')) return 'fragment';
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href) ? 'external' : 'local';
}

/** GitHub-style heading slugs, so links written for other Markdown viewers keep working. */
export const slugify = (text: string): string =>
  text.trim().toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-');

/**
 * Renders Markdown without raw HTML. Heading ids are scoped to each rendering so several documents
 * on a page cannot collide; `onLocalLink` receives relative document links, and without it they stay inert
 * so a preview can never navigate away from an unsaved draft.
 */
export function SafeMarkdown({ children, fragment, onLocalLink, onMissingFragment }: {
  children: string; fragment?: string | null | undefined; onLocalLink?: ((href: string) => void) | undefined;
  onMissingFragment?: ((fragment: string) => void) | undefined;
}) {
  const scope = useId();
  const container = useRef<HTMLDivElement>(null);
  function scrollToFragment(fragment: string) {
    let wanted: string;
    try { wanted = slugify(decodeURIComponent(fragment)); } catch { wanted = slugify(fragment); }
    const target = [...container.current?.querySelectorAll<HTMLElement>('[id]') ?? []].find((element) => element.id === `${scope}-${wanted}`);
    if (target) target.scrollIntoView?.({ block: 'start' });
    else onMissingFragment?.(fragment);
  }
  // Ids are assigned after rendering so duplicate headings are numbered once, in document order.
  useEffect(() => {
    const used = new Map<string, number>();
    for (const element of container.current?.querySelectorAll<HTMLElement>('h2, h3, h4, h5, h6') ?? []) {
      const slug = slugify(element.textContent ?? '') || 'section';
      const count = used.get(slug) ?? 0;
      used.set(slug, count + 1);
      element.id = `${scope}-${count ? `${slug}-${count}` : slug}`;
    }
    if (fragment) scrollToFragment(fragment);
  }, [fragment, children]);
  return <Prose ref={container} maxW="full" css={{ "& code, & pre": { fontFamily: "body" } }}>
    <Markdown skipHtml remarkPlugins={[remarkGfm]} components={{
      h1: 'h3',
      a: ({ href, children: label }) => {
        if (!href) return <>{label}</>;
        const kind = classifyLink(href);
        if (kind === 'external') return <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
        if (kind === 'fragment') {
          return <a href={href} onClick={(event) => { event.preventDefault(); scrollToFragment(href.slice(1)); }}>{label}</a>;
        }
        if (!onLocalLink) return <span className="inactive-link" title="Document links open from the saved Markdown.">{label}</span>;
        return <a href={href} onClick={(event) => { event.preventDefault(); onLocalLink(href); }}>{label}</a>;
      },
    }}>{children}</Markdown>
  </Prose>;
}
