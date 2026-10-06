import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [folder, setFolder] = useState<string>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function loadContext() {
      try {
        const response = await fetch('/api/context', { signal: controller.signal });
        if (!response.ok) throw new Error('Context unavailable');
        const context: unknown = await response.json();
        if (typeof context !== 'object' || context === null || !('folder' in context) || typeof context.folder !== 'string') {
          throw new Error('Invalid context');
        }
        setFolder(context.folder);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void loadContext();
    return () => controller.abort();
  }, []);
  return (
    <main>
      <p className="eyebrow">Markdown issue board · Local preview</p>
      <h1>md-kanban</h1>
      <p className="intro">Your Markdown. Your workspace.</p>
      <section aria-labelledby="folder-heading">
        <h2 id="folder-heading">Selected folder</h2>
        {error ? <p role="alert">Could not load folder context. Check that the local server is running, then reload.</p> :
          <p className="folder">{folder ?? 'Loading folder…'}</p>}
      </section>
      <section aria-labelledby="next-heading">
        <h2 id="next-heading">The local app is ready</h2>
        <p>Issue loading and boards are coming in the next implementation slice.</p>
        <p className="muted">Keep the terminal process running while using this app. Press Ctrl+C in the terminal to stop it.</p>
      </section>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing app root');
createRoot(root).render(<StrictMode><App /></StrictMode>);
