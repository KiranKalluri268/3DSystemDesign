import { useEffect } from 'react';
import { useBoard } from '../state/store';

/**
 * Keyboard shortcuts for the board.
 *
 * Escape backs out of whatever mode is active — disarms the palette, or
 * leaves linking mode — which is the way out of "every click does the same
 * thing again" without a discoverable UI affordance for it.
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
          } else if (store.selectedLinkId) {
            event.preventDefault();
            store.deleteSelectedLink();
          }
          break;
        case 'Escape':
          store.armKind(null);
          store.select(null);
          store.selectLink(null);
          store.setLinking(false);
          break;
        case 'c':
        case 'C':
          store.setLinking(!store.linking);
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
