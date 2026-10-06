import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { RouterProvider } from 'react-router';
import { ClientProviders, createClientRouter } from './ClientState';

const root = document.getElementById('root');
if (!root) throw new Error('Missing app root');
const router = createClientRouter(<App />);
createRoot(root).render(<StrictMode><ClientProviders><RouterProvider router={router} /></ClientProviders></StrictMode>);
