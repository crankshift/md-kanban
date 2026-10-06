import { z } from 'zod';
import { boardSchema } from '../server/board.js';
import { Board } from './Board';
import { boardKey, useDiskQuery } from './ClientState';

const contextSchema = z.object({ folder: z.string(), sessionToken: z.string() });
export function App() {
  const context = useDiskQuery(['disk', 'context'], '/api/context', contextSchema);
  const board = useDiskQuery(boardKey, '/api/issues', boardSchema);
  const folder = context.data?.folder;
  const sessionToken = context.data?.sessionToken;
  const data = board.data;
  const error = context.isError || board.isError;
  return (
    <main>
      <header>
        <p className="eyebrow">Markdown issue board</p>
        <h1>md-kanban</h1>
        <p className="folder">{folder ?? 'Loading selected folder…'}</p>
      </header>
      {data ? <Board data={data} sessionToken={sessionToken} /> : error
        ? <p role="alert">Could not load the board. Check folder access and that the local server is running, then reload.</p>
        : <p role="status">Discovering issues…</p>}
      {data && context.isError && <p role="alert">Could not refresh the local session. The open editor is kept; reconnect to the local server.</p>}
      <p className="muted">Keep the terminal process running while using this app. Press Ctrl+C in the terminal to stop it.</p>
    </main>
  );
}
