import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Offline support.
 *
 * The service worker is registered only for real http(s) origins. Registering
 * from file:// throws, and in dev it would serve stale bundles over Vite's HMR,
 * so both are skipped deliberately rather than by accident.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    // Resolved against the document URL, not the module URL: the bundle lives
    // under assets/ but sw.js is copied to the deploy root, and a worker cannot
    // control a scope above its own path.
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
      // Offline is an enhancement. If it fails the app still works online, and
      // the About page reports the real registration state rather than claiming
      // offline support that is not there.
      console.info('Offline caching unavailable:', err?.message ?? err);
    });
  });
}
