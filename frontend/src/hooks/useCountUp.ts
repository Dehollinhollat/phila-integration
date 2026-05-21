// src/hooks/useCountUp.ts
// Animation count-up pour les valeurs numériques des KPIs.
// Interpole de 0 à target en ~1s (60fps via intervalle de 16ms).
// Redémarre automatiquement si target change (ex : changement de filtre).

import { useState, useEffect } from 'react';

export const useCountUp = (target: number, duration = 1000): number => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let current = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return count;
};
