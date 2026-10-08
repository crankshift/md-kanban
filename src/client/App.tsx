import { z } from 'zod';
import { boardSchema } from '../server/board.js';
import { Board } from './Board';
import { boardKey, useDiskQuery } from './ClientState';
import { Workspace } from './workspace/Workspace';

const contextSchema = z.object({ folder: z.string(), sessionToken: z.string() });
export function App() {
  const context = useDiskQuery(['disk', 'context'], '/api/context', contextSchema);
  const board = useDiskQuery(boardKey, '/api/issues', boardSchema);
  const folder = context.data?.folder;
  const sessionToken = context.data?.sessionToken;
  const data = board.data;
  return <><Workspace folder={folder} issues={data} canWrite={!!sessionToken} sessionProblem={context.isError} />
    {data && <Board data={data} sessionToken={sessionToken} folder={folder} sessionProblem={context.isError} embedded />}
  </>;
}
