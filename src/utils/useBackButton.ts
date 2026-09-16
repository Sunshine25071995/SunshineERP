import { useEffect, useCallback } from 'react';

export function useBackButton(isOpen: boolean, onClose: () => void) {
  const handlePopState = useCallback((e: PopStateEvent) => {
    if (isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      // Push a new state into the history when the view opens
      window.history.pushState({ modalOpen: true }, '');
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      if (isOpen) {
        window.removeEventListener('popstate', handlePopState);
      }
    };
  }, [isOpen, handlePopState]);
}
