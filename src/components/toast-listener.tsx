'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function ToastListener() {
  useEffect(() => {
    const handler = (event: Event) => {
      const { type, message } = (event as CustomEvent<{ type: string; message: string }>).detail;
      if (type === 'error') {
        toast.error(message);
      }
    };

    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  return null;
}
