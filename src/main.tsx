import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useBoard } from './state/store';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// Dev-only handle on the board, so a browser session can be inspected and
// driven from the console. Lives in the entry point rather than the store so
// it is never pulled into a headless test.
if (import.meta.env.DEV) {
  (window as unknown as { __board: typeof useBoard }).__board = useBoard;
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
