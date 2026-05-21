// src/components/common/PageTransition.tsx
// Enveloppe une page dans une animation d'entrée/sortie framer-motion.
// À utiliser comme wrapper direct dans les composants de page.

import { motion, type Transition } from 'framer-motion';
import { type ReactNode } from 'react';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  in:      { opacity: 1, y: 0 },
  out:     { opacity: 0, y: -8 },
};

const pageTransition: Transition = {
  type:     'tween',
  ease:     'easeInOut',
  duration: 0.2,
};

interface Props {
  children: ReactNode;
}

export default function PageTransition({ children }: Props) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  );
}
