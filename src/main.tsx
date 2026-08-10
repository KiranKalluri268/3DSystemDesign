import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useBoard } from './state/store';
import { useRun } from './state/runStore';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// Dev-only handles on the stores, so a browser session can be inspected and
// driven from the console. Live in the entry point rather than the stores so
// they are never pulled into a headless test.
if (import.meta.env.DEV) {
  (window as unknown as { __board: typeof useBoard; __run: typeof useRun }).__board = useBoard;
  (window as unknown as { __run: typeof useRun }).__run = useRun;
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
