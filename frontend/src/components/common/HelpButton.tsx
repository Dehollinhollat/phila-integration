import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen } from 'lucide-react';

interface HelpStep {
  titre: string;
  description: string;
  emoji?: string;
}

interface HelpButtonProps {
  steps: HelpStep[];
  titre: string;
}

export const HelpButton = ({ steps, titre }: HelpButtonProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background:     'none',
          border:         '1px solid var(--bg-card-border)',
          borderRadius:   '50%',
          width:          '32px',
          height:         '32px',
          cursor:         'pointer',
          color:          'var(--text-secondary)',
          fontSize:       '14px',
          fontWeight:     700,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
        }}
        title="Aide"
      >
        ?
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position:       'fixed',
              inset:          0,
              background:     'rgba(0,0,0,0.6)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              zIndex:         2000,
              padding:        '16px',
            }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background:   'var(--bg-card)',
                borderRadius: '12px',
                padding:      '24px',
                width:        'min(500px, calc(100% - 32px))',
                maxHeight:    '80vh',
                overflowY:    'auto',
                border:       '1px solid var(--bg-card-border)',
                boxShadow:    '0 8px 32px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={18} /> {titre}
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '20px' }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {steps.map((step, i) => (
                  <div key={i} style={{
                    display:      'flex',
                    gap:          '12px',
                    padding:      '12px',
                    background:   'var(--bg-primary)',
                    borderRadius: '8px',
                    border:       '1px solid var(--bg-card-border)',
                  }}>
                    <div style={{
                      minWidth:       '28px',
                      height:         '28px',
                      borderRadius:   '50%',
                      background:     'var(--accent-blue)',
                      color:          'white',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      fontWeight:     700,
                      fontSize:       '13px',
                      flexShrink:     0,
                    }}>
                      {step.emoji ?? i + 1}
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                        {step.titre}
                      </p>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
