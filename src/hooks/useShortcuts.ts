import { useEffect } from 'react';

export interface ShortcutHandlers {
  onAdd?: () => void;    // F2
  onEdit?: () => void;   // F4
  onPrint?: () => void;  // F8
  onSave?: () => void;   // Ctrl+Enter
}

export function useShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2' && handlers.onAdd) { e.preventDefault(); handlers.onAdd(); }
      else if (e.key === 'F4' && handlers.onEdit) { e.preventDefault(); handlers.onEdit(); }
      else if (e.key === 'F8' && handlers.onPrint) { e.preventDefault(); handlers.onPrint(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && handlers.onSave) {
        e.preventDefault(); handlers.onSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers, enabled]);
}
