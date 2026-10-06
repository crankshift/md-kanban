import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function SafeMarkdown({ children }: { children: string }) {
  return <Markdown skipHtml remarkPlugins={[remarkGfm]} components={{ h1: 'h3' }}>{children}</Markdown>;
}
