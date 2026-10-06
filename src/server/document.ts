// Share metadata boundaries between reading and targeted writes, retaining character offsets.
export function* leadingMetadata(content: string) {
  let foundHeading = false;
  for (const lineMatch of content.matchAll(/[^\n]*(?:\n|$)/g)) {
    const raw = lineMatch[0].replace(/\r?\n$/, '');
    const bom = lineMatch.index === 0 && raw.startsWith('\uFEFF') ? 1 : 0;
    const line = raw.slice(bom);
    if (/^#\s/.test(line) && !foundHeading) { foundHeading = true; continue; }
    if (/^#{1,6}\s/.test(line)) break;
    if (!line.trim()) continue;
    const match = line.match(/^(\s*(?:\*\*(Status|Type|Blocked by):\*\*|\*\*(Status|Type|Blocked by)\*\*:|(Status|Type|Blocked by):)\s*)(.*?)\s*$/i);
    if (!match && !/^\s*(?:\*\*)?(Status|Type|Blocked by)\b/i.test(line) && foundHeading) break;
    yield { line, match, start: lineMatch.index + bom, end: lineMatch.index + lineMatch[0].length };
  }
}

// Recognize section headings outside fenced examples. Indented code/quotes are not sections.
function sectionHeadings(content: string) {
  const headings: { start: number; end: number; level: number; title: string }[] = [];
  let fence: { character: string; length: number } | undefined;
  for (const line of content.matchAll(/[^\n]*(?:\n|$)/g)) {
    const text = line[0].replace(/\r?\n$/, '');
    const marker = text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = { character: marker[1]![0]!, length: marker[1]!.length };
      else if (marker[1]![0] === fence.character && marker[1]!.length >= fence.length && !marker[2]!.trim()) fence = undefined;
      continue;
    }
    if (fence) continue;
    const heading = text.match(/^ {0,3}(#{1,2})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/);
    if (heading) headings.push({ start: line.index, end: line.index + line[0].length, level: heading[1]!.length, title: heading[2]! });
  }
  return { headings, unclosedFence: !!fence };
}

export function issueDocument(content: string) {
  const { headings, unclosedFence } = sectionHeadings(content);
  const comments = headings.filter((heading) => heading.level === 2 && heading.title.toLowerCase() === 'comments');
  if (comments.length > 1 || unclosedFence) throw new Error('Cannot safely separate this document: duplicate Comments sections or an unclosed code fence. Edit the Markdown directly and reload.');
  let metadataEnd = headings.find((heading) => heading.level === 1)?.end ?? 0;
  for (const entry of leadingMetadata(content)) metadataEnd = entry.end;
  const commentsHeading = comments[0];
  const regionEnd = commentsHeading?.start ?? content.length;
  const region = content.slice(metadataEnd, regionEnd);
  const leading = region.match(/^(?:[ \t]*\r?\n)*/)?.[0].length ?? 0;
  const bodyStart = metadataEnd + leading;
  const bodyEnd = Math.max(bodyStart, regionEnd - (region.match(/(?:\r?\n)+$/)?.[0].length ?? 0));
  const commentsEnd = commentsHeading ? headings.find((heading) => heading.start > commentsHeading.start)?.start ?? content.length : content.length;
  return { bodyStart, bodyEnd, body: content.slice(bodyStart, bodyEnd), commentsStart: commentsHeading?.start ?? null,
    commentsEnd, comments: commentsHeading ? content.slice(commentsHeading.start, commentsEnd) : '' };
}

export function patchIssueBody(content: string, body: string): string {
  const scanned = sectionHeadings(body);
  if (scanned.unclosedFence || scanned.headings.some((heading) => heading.level === 2 && heading.title.toLowerCase() === 'comments')) {
    throw new Error('Keep Comments in its separate section and close all code fences in the body.');
  }
  const document = issueDocument(content);
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const value = body.replace(/\r\n|\r|\n/g, newline);
  if (value === document.body) return content;
  // An empty original body may have no separator from metadata/comments.
  const prefix = content.slice(0, document.bodyStart);
  const suffix = content.slice(document.bodyEnd);
  const empty = document.bodyStart === document.bodyEnd;
  return prefix + (empty && value && !prefix.endsWith('\n') ? newline + newline : '') + value +
    (empty && value && document.commentsStart !== null ? newline + newline : '') + suffix;
}

export function appendIssueComment(content: string, comment: string): string {
  const scanned = sectionHeadings(comment);
  if (scanned.unclosedFence || scanned.headings.length) throw new Error('Use headings at level ### or deeper in comments, and close all code fences.');
  const document = issueDocument(content);
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const prefix = content.slice(0, document.commentsEnd);
  const suffix = content.slice(document.commentsEnd);
  const gap = prefix.endsWith(newline + newline) ? '' : prefix.endsWith(newline) ? newline : newline + newline;
  const heading = document.commentsStart === null ? `## Comments${newline}${newline}` : '';
  return prefix + gap + heading + comment.replace(/\r\n|\r|\n/g, newline) + (suffix ? newline + newline : newline) + suffix;
}

// Repairs deliberately retain diagnostics until the server parses the saved file.
export function repairMarkdown(content: string, repair: { content: string } | { changes: { status?: string | undefined; type?: string | null | undefined } }): string {
  if ('content' in repair) return repair.content;
  for (const key of ['Status', 'Type'] as const) {
    const value = key === 'Status' ? repair.changes.status : repair.changes.type;
    if (value === undefined) continue;
    const entries = [...leadingMetadata(content)];
    const matches = entries.filter((entry) => entry.match &&
      (entry.match[2] ?? entry.match[3] ?? entry.match[4])?.toLowerCase() === key.toLowerCase());
    if (matches.length > 1) throw new Error(`Multiple ${key} lines: edit Markdown to choose which to keep.`);
    const entry = matches[0];
    if (entry) {
      if (value === null) content = content.slice(0, entry.start) + content.slice(entry.end);
      else {
        const start = entry.start + entry.match![1]!.length;
        content = content.slice(0, start) + value + content.slice(start + entry.match![5]!.length);
      }
    } else if (value !== null) {
      if (entries.some((entry) => !entry.match && new RegExp(`^\\s*(?:\\*\\*)?${key}\\b`, 'i').test(entry.line)))
        throw new Error(`Malformed ${key} line: edit Markdown to fix it.`);
      const newline = content.includes('\r\n') ? '\r\n' : '\n';
      const heading = content.match(/^\uFEFF?#.*(?:\r?\n|$)/m);
      const end = entries.at(-1)?.end ?? (heading ? heading.index! + heading[0].length : undefined);
      if (end === undefined) throw new Error('Add a title in the Markdown editor before inserting metadata.');
      const style = entries.find((entry) => entry.match)?.match?.[1]?.trim();
      const label = style ? style.replace(/Status|Type|Blocked by/i, key) : `${key}:`;
      const prefix = content.slice(0, end);
      content = prefix + (prefix.endsWith('\n') ? '' : newline) + `${label} ${value}${newline}` + content.slice(end);
    }
  }
  return content;
}
