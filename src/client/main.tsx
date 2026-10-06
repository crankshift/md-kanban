import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './style.css';
import { RouterProvider } from 'react-router';
import { ClientProviders, createClientRouter } from './ClientState';

const root = document.getElementById('root');
if (!root) throw new Error('Missing app root');
// PROTOTYPE — removed with the prototype. `pnpm prototype` builds in prototype mode; production builds drop this branch.
if (import.meta.env.MODE === 'prototype') void import('./prototype/PrototypeApp').then(({ mountPrototype }) => mountPrototype(root));
else {
  const router = createClientRouter(<App />);
  createRoot(root).render(<StrictMode><ClientProviders><RouterProvider router={router} /></ClientProviders></StrictMode>);
}
