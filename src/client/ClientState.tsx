import { Provider } from './components/ui/provider';
import { Toaster } from './components/ui/toaster';
import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBrowserRouter } from 'react-router';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
import { z } from 'zod';

export const diskKey = ['disk'] as const;
export const boardKey = [...diskKey, 'issues'] as const;
export async function readJson<T>(url: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, signal ? { signal } : undefined);
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(typeof value === 'object' && value !== null && 'error' in value ? String(value.error) : 'Cannot read the local server.');
  return schema.parse(value);
}
async function waitForWrites(client: QueryClient, signal: AbortSignal) {
  if (!client.isMutating({ mutationKey: ['write'] })) return;
  await new Promise<void>((resolve, reject) => {
    const finish = () => { unsubscribe(); signal.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(signal.reason); };
    const unsubscribe = client.getMutationCache().subscribe(() => {
      if (!client.isMutating({ mutationKey: ['write'] })) { finish(); resolve(); }
    });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    else if (!client.isMutating({ mutationKey: ['write'] })) { finish(); resolve(); }
  });
}
export function useDiskQuery<T>(key: readonly unknown[], url: string, schema: z.ZodType<T>, initialData?: T) {
  const client = useQueryClient();
  const writing = useIsMutating({ mutationKey: ['write'] }) > 0;
  return useQuery({ queryKey: key, queryFn: async ({ signal }) => { await waitForWrites(client, signal); return readJson(url, schema, signal); }, enabled: !writing,
    ...(initialData === undefined ? {} : { initialData }), retry: false, refetchOnWindowFocus: 'always' });
}
export function createClientRouter(children: ReactNode) {
  return createBrowserRouter([{ path: '*', element: <NuqsAdapter>{children}</NuqsAdapter> }]);
}
export function ClientProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false, gcTime: Infinity } } }));
  useEffect(() => {
    const refresh = () => { void client.invalidateQueries({ queryKey: diskKey }); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [client]);
  useEffect(() => () => client.clear(), [client]);
  return <Provider defaultTheme="system" enableSystem><QueryClientProvider client={client}>{children}<Toaster /></QueryClientProvider></Provider>;
}
