import { useEffect } from 'react';
import { useBoard } from '../state/store';

/**
 * Keyboard shortcuts for the board.
 *
 * Escape disarms the palette, which is the way out of "every click places
 * another component" — without it the only escape is clicking the armed
 * palette entry again, which is not discoverable.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      // Never steal a keystroke from a field the player is typing in.
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      const store = useBoard.getState();
      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          if (store.selectedId) {
            event.preventDefault();
            store.deleteSelected();
          }
          break;
        case 'Escape':
          store.armKind(null);
          store.select(null);
          break;
        case '+':
        case '=':
          if (store.selectedId) store.scaleSelected(1);
          break;
        case '-':
        case '_':
          if (store.selectedId) store.scaleSelected(-1);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
