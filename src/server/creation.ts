import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, open, readdir, realpath, unlink } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import { issueCreateSchema, type CreationTarget, type Issue, type IssueCreate } from './board.js';
import { discoverIssues } from './discovery.js';
import { editIssue } from './edits.js';
import { filenameNumber, parseIssue } from './issues.js';
import { leadingMetadata } from './document.js';
import { WriteError } from './writes.js';

const portable = (path: string) => path.split(sep).join('/');
const sameScope = (a: Pick<Issue, 'feature' | 'location'>, b: Pick<Issue, 'feature' | 'location'>) => a.feature === b.feature && a.location === b.location;

// A target must already contain an issue that establishes this workflow. Never guess from a folder name.
export async function creationTargets(folder: string): Promise<CreationTarget[]> {
  const root = folder;
  await safeDirectory(root, root);
  const board = await discoverIssues(root);
  const targets: CreationTarget[] = [];
  for (const issue of board.issues) {
    if (!issue.workflow || targets.some((target) => target.container === issue.container && target.workflow === issue.workflow)) continue;
    const scoped = board.issues.filter((candidate) => sameScope(issue, candidate));
    const directories = [...new Set(scoped.map((candidate) => candidate.container))].sort();
    const occupancy = [];
    for (const directory of directories) {
      const path = join(root, directory);
      await safeDirectory(root, path);
      const stat = await lstat(path);
      occupancy.push([directory, stat.dev, stat.ino, (await readdir(path)).filter((name) => !name.startsWith('.mdboard-')).sort()]);
    }
    const revision = createHash('sha256').update(JSON.stringify({ occupancy,
      issues: scoped.map((candidate) => [candidate.id, candidate.revision, candidate.diagnostics]) })).digest('hex');
    targets.push({ container: issue.container, feature: issue.feature, location: issue.location, workflow: issue.workflow, revision });
  }
  return targets;
}

async function safeDirectory(root: string, path: string) {
  if (path !== root && !path.startsWith(root + sep)) throw new WriteError(400, 'invalid_path', 'Container is outside the selected folder.');
  let current = root;
  for (const part of [null, ...relative(root, path).split(sep).filter(Boolean)]) {
    if (part !== null) current = join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new WriteError(400, 'invalid_path', 'Select an existing issue folder without symbolic links.');
  }
  if (await realpath(path) !== path) throw new WriteError(400, 'invalid_path', 'Container changed. Reload issues.');
}

function convention(issue: Issue) {
  const content = issue.content!;
  const firstHeading = content.replace(/^\uFEFF/, '').match(/^#[ \t]+([^\r\n]+)$/m)?.[1];
  const heading = firstHeading?.match(/^(\d+)(\s*[:.\-–—]\s*|\s+)/);
  const filename = basename(issue.path).match(/^(\d+)([-_. ])?/);
  const keys = new Map<string, string>();
  for (const { match } of leadingMetadata(content)) {
    if (match) keys.set((match[2] ?? match[3] ?? match[4])!.toLowerCase(), match[1]!.trim());
  }
  const statusKey = keys.get('status') ?? 'Status:';
  return { width: filename?.[1]?.length ?? heading?.[1]?.length ?? 2,
    separator: filename?.[2] ?? '-', headingSeparator: heading?.[2] ?? ': ',
    numberedTitle: !!heading, newline: content.includes('\r\n') ? '\r\n' : '\n',
    statusKey, dependencyKey: keys.get('blocked by') ?? statusKey.replace(/status/i, 'Blocked by'),
    typeKey: keys.get('type') ?? statusKey.replace(/status/i, 'Type') };
}

export async function createIssue(folder: string, input: IssueCreate): Promise<Issue> {
  const parsed = issueCreateSchema.safeParse(input);
  if (!parsed.success) throw new WriteError(400, 'invalid_request', parsed.error.issues.map((issue) => issue.message).join('; '));
  const request = parsed.data;
  const root = folder;
  await safeDirectory(root, root);
  const directory = join(root, request.container);
  const locks: string[] = [];
  let temporary: string | undefined;
  try {
    await safeDirectory(root, directory);
    const initialBoard = await discoverIssues(root);
    const context = initialBoard.issues.find((issue) => issue.container === request.container && issue.workflow === request.workflow);
    if (!context) throw new WriteError(422, 'container_unavailable', 'Select an existing container with a recognized workflow.');
    // Lock each discovered container in this scope. Overlapping launch roots share these paths,
    // and a directly selected issues/ folder never writes a lock outside its selected root.
    const directories = [...new Set(initialBoard.issues.filter((issue) => sameScope(context, issue)).map((issue) => join(root, issue.container)))].sort();
    for (const path of directories) {
      await safeDirectory(root, path);
      const lockPath = join(path, '.mdboard-create.lock');
      try { const handle = await open(lockPath, 'wx', 0o600); locks.push(lockPath); await handle.close(); }
      catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EEXIST') throw new WriteError(409, 'write_in_progress', 'Another creation is in progress. Reload and review before retrying. If interrupted, stop all mdboard processes before removing .mdboard-create.lock beside the issues.');
        throw error;
      }
    }
    async function checkRevision() {
      await safeDirectory(root, directory);
      const target = (await creationTargets(root)).find((candidate) => candidate.container === request.container && candidate.workflow === request.workflow);
      if (!target) throw new WriteError(422, 'container_unavailable', 'Select an existing container with a recognized workflow.');
      if (target.revision !== request.expectedRevision) throw new WriteError(409, 'stale_revision', 'This container changed on disk. Reload and review the latest issues before retrying; your draft is retained.');
      return target;
    }
    const target = await checkRevision();
    const board = await discoverIssues(root);
    const scoped = board.issues.filter((issue) => sameScope(target, issue));
    const template = scoped.find((issue) => issue.container === request.container && issue.workflow === request.workflow)!;
    const style = convention(template);
    let maximum = 0n;
    for (const issue of scoped) if (issue.number) maximum = BigInt(issue.number) > maximum ? BigInt(issue.number) : maximum;
    for (const container of new Set(scoped.map((issue) => issue.container))) {
      for (const name of await readdir(join(root, container))) {
        const number = filenameNumber(name);
        if (number && BigInt(number) > maximum) maximum = BigInt(number);
      }
    }
    const number = String(maximum + 1n).padStart(style.width, '0');
    const slug = request.title.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '') || 'issue';
    const path = portable(relative(root, join(directory, `${number}${style.separator}${slug}.md`)));
    const nl = style.newline;
    const content = `# ${style.numberedTitle ? number + style.headingSeparator : ''}${request.title}${nl}${nl}${style.statusKey} ${request.status}${nl}` +
      (request.workflow === 'wayfinding' ? `${style.typeKey} ${request.type ?? 'task'}${nl}` : '') + `${style.dependencyKey} None${nl}${nl}`;
    const issue = parseIssue({ ...target, path }, content);
    if (issue.workflow !== request.workflow || (request.workflow === 'implementation' && request.type !== undefined) || issue.title !== request.title) throw new WriteError(422, 'invalid_change', 'Use a title and status compatible with the selected workflow.');
    let saved: Issue;
    try {
      let rendered = editIssue(issue, { dependencies: request.dependencies, body: request.body }, board.issues);
      if (template.content!.endsWith('\n') && !rendered.endsWith('\n')) rendered += nl;
      saved = parseIssue(issue, rendered);
    }
    catch (error) { throw new WriteError(422, 'invalid_change', error instanceof Error ? error.message : 'Invalid issue content.'); }
    if (saved.workflow !== request.workflow || saved.title !== request.title) throw new WriteError(422, 'invalid_change', 'The body would change issue metadata. Start the Markdown body with a section heading or ordinary prose.');
    temporary = join(directory, `.mdboard-${randomUUID()}.tmp`);
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(saved.content!, 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    await checkRevision();
    // Hard-link publication is atomic and refuses any existing destination, unlike rename.
    await link(temporary, join(root, path));
    return saved;
  } catch (error) {
    if (error instanceof WriteError) throw error;
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') throw new WriteError(409, 'number_collision', 'The allocated filename is occupied. Reload and review before retrying.');
    throw new WriteError(500, 'write_failed', 'Could not create the issue. Check folder access and reload before retrying; your draft is retained.');
  } finally {
    if (temporary) await unlink(temporary).catch(() => {});
    for (const lock of locks) await unlink(lock).catch(() => {});
  }
}
