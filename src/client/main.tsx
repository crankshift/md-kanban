import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { boardSchema, type BoardData } from '../server/board.js';
import { Board } from './Board';
import './style.css';

const contextSchema = z.object({ folder: z.string(), sessionToken: z.string() });
function App() {
  const [folder, setFolder] = useState<string>();
  const [sessionToken, setSessionToken] = useState<string>();
  const [data, setData] = useState<BoardData>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [contextResponse, boardResponse] = await Promise.all([
          fetch('/api/context', { signal: controller.signal }),
          fetch('/api/issues', { signal: controller.signal }),
        ]);
        if (!contextResponse.ok || !boardResponse.ok) throw new Error('Board unavailable');
        const context = contextSchema.parse(await contextResponse.json());
        const board = boardSchema.parse(await boardResponse.json());
        if (!controller.signal.aborted) { setFolder(context.folder); setSessionToken(context.sessionToken); setData(board); }
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, []);
  return (
    <main>
      <header>
        <p className="eyebrow">Markdown issue board</p>
        <h1>md-kanban</h1>
        <p className="folder">{folder ?? 'Loading selected folder…'}</p>
      </header>
      {error ? <p role="alert">Could not load the board. Check folder access and that the local server is running, then reload.</p> :
        data ? <Board data={data} sessionToken={sessionToken} /> : <p role="status">Discovering issues…</p>}
      <p className="muted">Keep the terminal process running while using this app. Reload to read external changes. Press Ctrl+C in the terminal to stop it.</p>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing app root');
createRoot(root).render(<StrictMode><App /></StrictMode>);
