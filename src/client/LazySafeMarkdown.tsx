import { lazy } from 'react';

/** Shared by every consumer so the Markdown rendering pipeline lands in one chunk, loaded once. */
export const LazySafeMarkdown = lazy(() =>
  import('./SafeMarkdown').then((module) => ({ default: module.SafeMarkdown })),
);
