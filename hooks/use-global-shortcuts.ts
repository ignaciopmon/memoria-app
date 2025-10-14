"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const useGlobalShortcuts = () => {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignoramos si se está escribiendo en un input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Atajo para ir al Dashboard
      if (event.key.toLowerCase() === 'd') {
        event.preventDefault();
        router.push('/dashboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [router]);
};