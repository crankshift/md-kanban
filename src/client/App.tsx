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
  return data ? <Board data={data} sessionToken={sessionToken} folder={folder} sessionProblem={context.isError} /> :
    <main>{error ? <p role="alert">Could not load the board. Check folder access and that the local server is running, then reload.</p> : <p role="status">Discovering issues…</p>}</main>;
}
