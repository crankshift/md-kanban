import { z } from 'zod';
import { useDiskQuery } from './ClientState';
import { Workspace } from './workspace/Workspace';

const contextSchema = z.object({ folder: z.string(), sessionToken: z.string() });
export function App() {
  const context = useDiskQuery(['disk', 'context'], '/api/context', contextSchema);
  const folder = context.data?.folder;
  const sessionToken = context.data?.sessionToken;
  return <Workspace folder={folder} sessionToken={sessionToken} canWrite={!!sessionToken} sessionProblem={context.isError} />;
}
