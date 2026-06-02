import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  open:      boolean;
  onClose:   () => void;
  children:  ReactNode;
  width?:    string;
  title?:    string;
}

export const Modal = ({
  open,
  onClose,
  children,
  width = 'min(520px, calc(100% - 32px))',
  title,
}: ModalProps) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position:       'fixed',
            inset:          0,
            background:     'rgba(0,0,0,0.75)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            zIndex:         1000,
            padding:        '16px',
            boxSizing:      'border-box',
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            style={{
              background:   'var(--bg-card-solid, #1a2332)',
              borderRadius: '12px',
              padding:      '24px',
              width,
              maxHeight:    '90vh',
              overflowY:    'auto',
              boxShadow:    '0 8px 32px rgba(0,0,0,0.4)',
              border:       '1px solid var(--bg-card-border)',
              boxSizing:    'border-box',
            }}
          >
            {title && (
              <div style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
                marginBottom:   '20px',
              }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', fontWeight: 700 }}>
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border:     'none',
                    cursor:     'pointer',
                    color:      'var(--text-secondary)',
                    fontSize:   '20px',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
