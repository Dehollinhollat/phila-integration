// src/features/admin/UserManagement.tsx
// Gestion des comptes utilisateurs - super_admin uniquement.
// Affiche stats, table filtrée, modal création/édition, modal réinitialisation mot de passe.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAdminEndpoints } from '../../services/endpoints';
import type { DeleteConflict } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import type { User, Role, Campus, ConnectionLog } from '../../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<Role, { label: string; bg: string; text: string; desc: string }> = {
  super_admin:           { label: 'Super Admin',    bg: 'var(--badge-integre-bg)',   text: 'var(--badge-integre-text)',   desc: 'Accès total, tous campus, configuration système' },
  admin_campus:          { label: 'Admin Campus',   bg: 'var(--badge-contacte-bg)',  text: 'var(--badge-contacte-text)',  desc: 'Gestion complète de son campus' },
  referent_eglise:       { label: 'Réf. Église',    bg: 'var(--badge-ensuivi-bg)',   text: 'var(--badge-ensuivi-text)',   desc: 'Suivi pastoral approfondi' },
  referent_integration:  { label: 'Réf. Intégration',bg: 'var(--badge-nouveau-bg)', text: 'var(--badge-nouveau-text)',   desc: 'Premier suivi des nouveaux' },
  lecteur:               { label: 'Lecteur',         bg: 'var(--badge-inactif-bg)',  text: 'var(--badge-inactif-text)',   desc: 'Consultation uniquement' },
};

const CAMPUS_LABELS: Record<Campus, string> = {
  paris:      'Paris',
  paris_nord: 'Paris Nord',
};

const ALL_CAMPUS: Campus[] = ['paris', 'paris_nord'];

// ─── Composants locaux ────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <span style={{
      display:      'inline-block',
      padding:      '2px 8px',
      borderRadius: 999,
      fontSize:     11,
      fontWeight:   600,
      background:   cfg.bg,
      color:        cfg.text,
      whiteSpace:   'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function Avatar({ prenom, nom }: { prenom: string; nom: string }) {
  return (
    <div style={{
      width:          34, height: 34,
      borderRadius:   '50%',
      background:     'var(--accent-teal)',
      color:          '#fff',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontSize:       13,
      fontWeight:     700,
      flexShrink:     0,
    }}>
      {prenom[0]}{nom[0]}
    </div>
  );
}

// ─── Types internes ───────────────────────────────────────────────────────────

interface FormState {
  prenom: string; nom: string; email: string;
  role: Role; campus: Campus[]; actif: boolean;
}

const EMPTY_FORM: FormState = {
  prenom: '', nom: '', email: '',
  role: 'lecteur', campus: [], actif: true,
};

// ─── Composant principal ──────────────────────────────────────────────────────

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin  = currentUser?.role === 'super_admin';
  const isAdminCampus = currentUser?.role === 'admin_campus';

  const [users,      setUsers]      = useState<User[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filterRole, setFilterRole] = useState<Role | ''>('');
  const [filterCampus, setFilterCampus] = useState<Campus | ''>('');

  const [modal,     setModal]     = useState<'create' | 'edit' | 'password' | 'connexions' | null>(null);
  const [selected,  setSelected]  = useState<User | null>(null);
  const [connexions, setConnexions] = useState<ConnectionLog[]>([]);
  const [connexionsLoading, setConnexionsLoading] = useState(false);
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [pwdNew,    setPwdNew]    = useState('');
  const [pwdConf,   setPwdConf]   = useState('');

  const [emailOk,   setEmailOk]   = useState<boolean | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Suppression de compte ────────────────────────────────────────────────────
  const [deleteTarget,   setDeleteTarget]   = useState<User | null>(null);
  const [deleteConflict, setDeleteConflict] = useState<DeleteConflict | null>(null);
  const [deleting,       setDeleting]       = useState(false);

  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Signale l'ouverture d'un modal pour fermer le panneau notifications
  useEffect(() => {
    if (modal || deleteTarget) {
      document.dispatchEvent(new CustomEvent('modal-opened'));
    }
  }, [modal, deleteTarget]);

  // ── Chargement ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersAdminEndpoints.list(filterCampus || undefined, filterRole || undefined);
      setUsers(res.data);
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterCampus]);

  useEffect(() => { load(); }, [load]);

  // ── Email live check ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!form.email) { setEmailOk(null); return; }
    if (emailTimer.current) clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(async () => {
      try {
        const res = await usersAdminEndpoints.checkEmail(
          form.email,
          modal === 'edit' && selected ? selected.id : undefined
        );
        setEmailOk(res.data.available);
      } catch { setEmailOk(null); }
    }, 400);
    return () => { if (emailTimer.current) clearTimeout(emailTimer.current); };
  }, [form.email, modal, selected]);

  // ── Filtrage côté client (search) ────────────────────────────────────────────

  const visible = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.prenom.toLowerCase().includes(q) ||
      u.nom.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = {
    total:   users.length,
    actif:   users.filter(u => u.actif).length,
    inactif: users.filter(u => !u.actif).length,
    super_admin: users.filter(u => u.role === 'super_admin').length,
    admin_campus: users.filter(u => u.role === 'admin_campus').length,
  };

  // ── Handlers modal ───────────────────────────────────────────────────────────

  function openCreate() {
    setForm(EMPTY_FORM);
    setEmailOk(null);
    setError(null);
    setModal('create');
  }

  function openEdit(u: User) {
    setSelected(u);
    setForm({ prenom: u.prenom, nom: u.nom, email: u.email, role: u.role, campus: u.campus, actif: u.actif });
    setEmailOk(null);
    setError(null);
    setModal('edit');
  }

  function openPassword(u: User) {
    setSelected(u);
    setPwdNew(''); setPwdConf('');
    setError(null);
    setModal('password');
  }

  function closeModal() { setModal(null); setSelected(null); setConnexions([]); }

  async function openConnexions(u: User) {
    setSelected(u);
    setModal('connexions');
    setConnexionsLoading(true);
    try {
      const res = await usersAdminEndpoints.connexions(u.id);
      setConnexions(res.data);
    } catch { setConnexions([]); }
    finally { setConnexionsLoading(false); }
  }

  // ── Submit user form ─────────────────────────────────────────────────────────

  async function handleSubmitUser(e: React.FormEvent) {
    e.preventDefault();
    if (emailOk === false) { setError('Cet email est déjà utilisé'); return; }
    setSaving(true); setError(null);
    try {
      if (modal === 'create') {
        const res = await usersAdminEndpoints.create({ ...form });
        setUsers(prev => [res.data, ...prev]);
        // Affiche la confirmation avec l'email de destination
        setSuccessMsg(`Compte créé. Un email avec un mot de passe provisoire a été envoyé à ${res.data.email}.`);
      } else if (modal === 'edit' && selected) {
        const payload: Partial<User> = { prenom: form.prenom, nom: form.nom, email: form.email, role: form.role, campus: form.campus, actif: form.actif };
        const res = await usersAdminEndpoints.update(selected.id, payload);
        setUsers(prev => prev.map(u => u.id === selected.id ? res.data : u));
      }
      closeModal();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Une erreur est survenue');
    } finally { setSaving(false); }
  }

  // ── Submit password reset ────────────────────────────────────────────────────

  async function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwdNew.length < 8) { setError('Au moins 8 caractères'); return; }
    if (pwdNew !== pwdConf) { setError('Les mots de passe ne correspondent pas'); return; }
    setSaving(true); setError(null);
    try {
      await usersAdminEndpoints.resetPassword(selected!.id, pwdNew);
      closeModal();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Une erreur est survenue');
    } finally { setSaving(false); }
  }

  // ── Toggle statut ────────────────────────────────────────────────────────────

  async function handleToggle(u: User) {
    try {
      const res = await usersAdminEndpoints.toggleStatut(u.id);
      setUsers(prev => prev.map(x => x.id === u.id ? res.data : x));
    } catch { /* silent */ }
  }

  // ── Suppression ──────────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await usersAdminEndpoints.delete(deleteTarget.id);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setSuccessMsg(res.data.message);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string; contacts_integration?: number; contacts_eglise?: number } } };
      if (axiosErr.response?.status === 409 && axiosErr.response.data) {
        // L'utilisateur a des contacts assignés - affiche le modal de réassignation
        setDeleteConflict({
          message:              axiosErr.response.data.message ?? '',
          contacts_integration: axiosErr.response.data.contacts_integration ?? 0,
          contacts_eglise:      axiosErr.response.data.contacts_eglise ?? 0,
        });
      } else {
        setSuccessMsg(null);
        setError(axiosErr.response?.data?.message ?? 'Erreur lors de la suppression');
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  // ── Campus toggle helper ─────────────────────────────────────────────────────

  function toggleCampus(c: Campus) {
    setForm(f => ({
      ...f,
      campus: f.campus.includes(c) ? f.campus.filter(x => x !== c) : [...f.campus, c],
    }));
  }

  // ─── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      {/* Titre */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          Gestion des comptes
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Création, modification et accès des utilisateurs de la plateforme.
        </p>
      </div>

      {/* Bannière de succès - création de compte */}
      {successMsg && (
        <div style={{
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
          gap:          12,
          background:   'var(--badge-integre-bg)',
          color:        'var(--badge-integre-text)',
          border:       '1px solid var(--badge-integre-text)33',
          borderRadius: 10,
          padding:      '12px 16px',
          marginBottom: 20,
          fontSize:     14,
        }}>
          <span>✓ {successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: stats.total },
          { label: 'Actifs', value: stats.actif },
          { label: 'Inactifs', value: stats.inactif },
          { label: 'Super admins', value: stats.super_admin },
          { label: 'Admins campus', value: stats.admin_campus },
        ].map(s => (
          <div key={s.label} style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--bg-card-border)',
            borderRadius: 10,
            padding:      '12px 20px',
            minWidth:     110,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Barre filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Rechercher nom, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 200px', maxWidth: 280 }}
        />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value as Role | '')} style={inputStyle}>
          <option value="">Tous les rôles</option>
          {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
            <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
          ))}
        </select>
        <select value={filterCampus} onChange={e => setFilterCampus(e.target.value as Campus | '')} style={inputStyle}>
          <option value="">Tous les campus</option>
          {ALL_CAMPUS.map(c => <option key={c} value={c}>{CAMPUS_LABELS[c]}</option>)}
        </select>
        <button onClick={openCreate} style={btnPrimary}>+ Nouvel utilisateur</button>
      </div>

      {/* Table */}
      <div style={{
        background:   'var(--bg-card)',
        border:       '1px solid var(--bg-card-border)',
        borderRadius: 12,
        overflow:     'hidden',
      }}>
        {/* Header table */}
        <div style={{ ...tableRow, background: 'var(--bg-secondary)', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <div style={{ flex: '0 0 36px' }} />
          <div style={{ flex: 3 }}>Utilisateur</div>
          <div style={{ flex: 2 }}>Rôle</div>
          <div style={{ flex: 2 }}>Campus</div>
          <div style={{ flex: 1, textAlign: 'center' }}>Statut</div>
          <div style={{ flex: 2 }}>Créé le</div>
          <div style={{ flex: 2, textAlign: 'right' }}>Actions</div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            Chargement…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            Aucun utilisateur trouvé
          </div>
        ) : (
          visible.map((u, i) => (
            <div key={u.id} style={{
              ...tableRow,
              borderTop: i === 0 ? 'none' : '1px solid var(--bg-card-border)',
              opacity: u.actif ? 1 : 0.55,
            }}>
              <div style={{ flex: '0 0 36px' }}><Avatar prenom={u.prenom} nom={u.nom} /></div>
              <div style={{ flex: 3, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.prenom} {u.nom}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.email}
                </div>
              </div>
              <div style={{ flex: 2 }}><RoleBadge role={u.role} /></div>
              <div style={{ flex: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {u.campus.map(c => (
                  <span key={c} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                    {CAMPUS_LABELS[c]}
                  </span>
                ))}
                {u.campus.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>-</span>}
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                  background: u.actif ? 'var(--accent-teal)' : 'var(--text-tertiary)',
                }} title={u.actif ? 'Actif' : 'Inactif'} />
              </div>
              <div style={{ flex: 2, fontSize: 12, color: 'var(--text-secondary)' }}>
                {new Date(u.created_at).toLocaleDateString('fr-FR')}
              </div>
              <div style={{ flex: 2, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {/* Un admin_campus ne peut pas gérer les comptes super_admin */}
                {!(isAdminCampus && u.role === 'super_admin') ? (
                  <>
                    <button onClick={() => openEdit(u)} style={btnAction} title="Modifier">✏️</button>
                    <button onClick={() => openPassword(u)} style={btnAction} title="Réinitialiser mot de passe">🔑</button>
                    <button onClick={() => openConnexions(u)} style={btnAction} title="Historique des connexions">🕐</button>
                    <button onClick={() => handleToggle(u)} style={btnAction} title={u.actif ? 'Désactiver' : 'Activer'}>
                      {u.actif ? '🔒' : '🔓'}
                    </button>
                    {/* Suppression - super_admin uniquement, pas sur soi-même ni sur un autre super_admin */}
                    {isSuperAdmin && u.id !== currentUser?.id && u.role !== 'super_admin' && (
                      <button
                        onClick={() => setDeleteTarget(u)}
                        style={{ ...btnAction, color: 'var(--accent-red, #A32D2D)' }}
                        title="Supprimer le compte"
                      >
                        🗑️
                      </button>
                    )}
                  </>
                ) : (
                  <button onClick={() => openConnexions(u)} style={btnAction} title="Historique des connexions">🕐</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Modals ── */}
      {(modal === 'create' || modal === 'edit') && (
        <ModalOverlay onClose={closeModal}>
          <form onSubmit={handleSubmitUser}>
            <ModalHeader title={modal === 'create' ? 'Nouvel utilisateur' : 'Modifier le compte'} onClose={closeModal} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '20px 24px' }}>
              <Field label="Prénom *">
                <input required value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Nom *">
                <input required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Email *" style={{ gridColumn: '1 / -1' }}>
                <input
                  required type="email"
                  value={form.email}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setEmailOk(null); }}
                  style={{ ...inputStyle, borderColor: emailOk === false ? '#DC2626' : emailOk === true ? 'var(--accent-teal)' : undefined }}
                />
                {emailOk === false && <span style={{ fontSize: 11, color: '#DC2626' }}>Cet email est déjà utilisé</span>}
                {emailOk === true  && <span style={{ fontSize: 11, color: 'var(--accent-teal)' }}>Email disponible</span>}
              </Field>
              {modal === 'create' && (
                <div style={{
                  gridColumn:   '1 / -1',
                  display:      'flex',
                  alignItems:   'flex-start',
                  gap:          10,
                  background:   'var(--badge-contacte-bg)',
                  border:       '1px solid var(--badge-contacte-text)33',
                  borderRadius: 8,
                  padding:      '10px 14px',
                  fontSize:     13,
                  color:        'var(--text-secondary)',
                  lineHeight:   1.5,
                }}>
                  <span style={{ flexShrink: 0, fontSize: 16 }}>🔑</span>
                  <span>
                    Un mot de passe provisoire sera <strong>généré automatiquement</strong> et
                    envoyé par email au nouvel utilisateur.
                  </span>
                </div>
              )}
              <Field label="Rôle *" style={{ gridColumn: '1 / -1' }}>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} style={inputStyle}>
                  {(Object.keys(ROLE_CONFIG) as Role[])
                    .filter(r => !(isAdminCampus && r === 'super_admin'))
                    .map(r => (
                      <option key={r} value={r}>{ROLE_CONFIG[r].label} - {ROLE_CONFIG[r].desc}</option>
                    ))}
                </select>
              </Field>
              <Field label="Campus" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  {ALL_CAMPUS.map(c => (
                    <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.campus.includes(c)} onChange={() => toggleCampus(c)} />
                      {CAMPUS_LABELS[c]}
                    </label>
                  ))}
                </div>
              </Field>
              {modal === 'edit' && (
                <Field label="Statut" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.actif} onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))} />
                    Compte actif
                  </label>
                </Field>
              )}
            </div>

            {error && <p style={{ margin: '0 24px 12px', fontSize: 12, color: '#DC2626' }}>{error}</p>}

            <ModalFooter onCancel={closeModal} submitLabel={modal === 'create' ? 'Créer' : 'Enregistrer'} loading={saving} />
          </form>
        </ModalOverlay>
      )}

      {modal === 'connexions' && selected && (
        <ModalOverlay onClose={closeModal}>
          <ModalHeader title={`Connexions - ${selected.prenom} ${selected.nom}`} onClose={closeModal} />
          <div style={{ padding: '16px 24px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
            {connexionsLoading ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center' }}>Chargement…</p>
            ) : connexions.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center' }}>Aucune connexion enregistrée</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {connexions.map(log => {
                  const ua = log.user_agent ?? '';
                  const browser = ua.includes('Chrome') ? 'Chrome'
                    : ua.includes('Firefox') ? 'Firefox'
                    : ua.includes('Safari') ? 'Safari'
                    : ua.includes('Edge') ? 'Edge'
                    : ua ? 'Autre' : '-';
                  const date = new Date(log.created_at);
                  return (
                    <div key={log.id} style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          12,
                      padding:      '10px 12px',
                      borderRadius: 8,
                      background:   'var(--bg-secondary)',
                      border:       '1px solid var(--bg-card-border)',
                      fontSize:     12,
                    }}>
                      <span style={{
                        padding:      '2px 8px',
                        borderRadius: 999,
                        fontWeight:   600,
                        fontSize:     11,
                        background:   log.succes ? 'var(--badge-integre-bg)' : 'var(--badge-inactif-bg)',
                        color:        log.succes ? 'var(--badge-integre-text)' : 'var(--badge-inactif-text)',
                        whiteSpace:   'nowrap',
                      }}>
                        {log.succes ? 'Succès' : 'Échec'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', minWidth: 130 }}>
                        {date.toLocaleDateString('fr-FR')} {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>{log.ip}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{browser}</span>
                      {log.raison && (
                        <span style={{ marginLeft: 'auto', color: 'var(--accent-red)', fontSize: 11 }}>{log.raison.replace(/_/g, ' ')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal confirmation suppression ── */}
      {deleteTarget && !deleteConflict && (
        <ModalOverlay onClose={() => { if (!deleting) setDeleteTarget(null); }}>
          <ModalHeader title="Supprimer ce compte ?" onClose={() => { if (!deleting) setDeleteTarget(null); }} />
          <div style={{ padding: '20px 24px' }}>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              Cette action est <strong>irréversible</strong>. Le compte de{' '}
              <strong>{deleteTarget.prenom} {deleteTarget.nom}</strong> sera définitivement supprimé.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Toutes les sessions actives seront invalidées.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--bg-card-border)' }}>
            <button type="button" onClick={() => setDeleteTarget(null)} style={btnSecondary} disabled={deleting}>
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              style={{ ...btnPrimary, background: '#A32D2D', opacity: deleting ? 0.7 : 1 }}
            >
              {deleting ? 'Suppression…' : 'Supprimer'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal conflit - contacts à réassigner ── */}
      {deleteConflict && deleteTarget && (
        <ModalOverlay onClose={() => { setDeleteConflict(null); setDeleteTarget(null); }}>
          <ModalHeader
            title="Réassignation requise avant suppression"
            onClose={() => { setDeleteConflict(null); setDeleteTarget(null); }}
          />
          <div style={{ padding: '20px 24px' }}>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {deleteConflict.message}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {deleteConflict.contacts_integration > 0 && (
                <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--bg-card-border)', fontSize: 13 }}>
                  <strong>{deleteConflict.contacts_integration}</strong> contact{deleteConflict.contacts_integration > 1 ? 's' : ''} en intégration
                </div>
              )}
              {deleteConflict.contacts_eglise > 0 && (
                <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--bg-card-border)', fontSize: 13 }}>
                  <strong>{deleteConflict.contacts_eglise}</strong> contact{deleteConflict.contacts_eglise > 1 ? 's' : ''} église
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--bg-card-border)' }}>
            <button
              type="button"
              onClick={() => { setDeleteConflict(null); setDeleteTarget(null); }}
              style={btnSecondary}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                navigate(`/contacts?referent=${deleteTarget.id}`);
                setDeleteConflict(null);
                setDeleteTarget(null);
              }}
              style={btnPrimary}
            >
              Voir ses contacts →
            </button>
          </div>
        </ModalOverlay>
      )}

      {modal === 'password' && selected && (
        <ModalOverlay onClose={closeModal}>
          <form onSubmit={handleSubmitPassword}>
            <ModalHeader title={`Réinitialiser -${selected.prenom} ${selected.nom}`} onClose={closeModal} />
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nouveau mot de passe *">
                <input required type="password" minLength={8} value={pwdNew} onChange={e => setPwdNew(e.target.value)} style={inputStyle} placeholder="8 caractères minimum" />
              </Field>
              <Field label="Confirmer le mot de passe *">
                <input required type="password" value={pwdConf} onChange={e => setPwdConf(e.target.value)} style={{ ...inputStyle, borderColor: pwdConf && pwdNew !== pwdConf ? '#DC2626' : undefined }} />
                {pwdConf && pwdNew !== pwdConf && <span style={{ fontSize: 11, color: '#DC2626' }}>Les mots de passe ne correspondent pas</span>}
              </Field>
            </div>
            {error && <p style={{ margin: '0 24px 12px', fontSize: 12, color: '#DC2626' }}>{error}</p>}
            <ModalFooter onCancel={closeModal} submitLabel="Réinitialiser" loading={saving} />
          </form>
        </ModalOverlay>
      )}
    </div>
  );
}

// ─── Primitives UI ────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1000,
        background:     'rgba(0, 0, 0, 0.7)',   // opacité augmentée : le fond de page ne transparaît plus
        backdropFilter: 'blur(4px)',             // flou derrière pour renforcer le focus sur le modal
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      <div style={{
        background:   'var(--bg-card)',
        border:       '1px solid var(--bg-card-border)',
        borderRadius: 12,
        width:        '100%',
        maxWidth:     520,
        maxHeight:    '90vh',
        overflowY:    'auto',
        position:     'relative',
        zIndex:       1001,                      // card toujours au-dessus de l'overlay
        boxShadow:    '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 24px', borderBottom: '1px solid var(--bg-card-border)',
    }}>
      <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-secondary)', lineHeight: 1, padding: '0 2px' }}>×</button>
    </div>
  );
}

function ModalFooter({ onCancel, submitLabel, loading }: { onCancel: () => void; submitLabel: string; loading: boolean }) {
  return (
    <div style={{
      display: 'flex', gap: 10, justifyContent: 'flex-end',
      padding: '16px 24px', borderTop: '1px solid var(--bg-card-border)',
    }}>
      <button type="button" onClick={onCancel} style={btnSecondary} disabled={loading}>Annuler</button>
      <button type="submit" style={btnPrimary} disabled={loading}>{loading ? 'Enregistrement…' : submitLabel}</button>
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding:      '8px 12px',
  border:       '1px solid var(--bg-input-border)',
  borderRadius: 8,
  background:   'var(--bg-input)',
  color:        'var(--text-primary)',
  fontSize:     13,
  outline:      'none',
  width:        '100%',
  boxSizing:    'border-box',
  fontFamily:   'inherit',
};

const btnPrimary: React.CSSProperties = {
  padding:      '8px 18px',
  background:   'var(--accent-teal)',
  color:        '#fff',
  border:       'none',
  borderRadius: 8,
  fontSize:     13,
  fontWeight:   600,
  cursor:       'pointer',
  fontFamily:   'inherit',
  whiteSpace:   'nowrap',
};

const btnSecondary: React.CSSProperties = {
  padding:      '8px 18px',
  background:   'var(--bg-secondary)',
  color:        'var(--text-secondary)',
  border:       '1px solid var(--bg-card-border)',
  borderRadius: 8,
  fontSize:     13,
  fontWeight:   600,
  cursor:       'pointer',
  fontFamily:   'inherit',
};

const btnAction: React.CSSProperties = {
  width:        28, height: 28,
  background:   'var(--bg-secondary)',
  border:       '1px solid var(--bg-card-border)',
  borderRadius: 6,
  cursor:       'pointer',
  fontSize:     14,
  display:      'flex',
  alignItems:   'center',
  justifyContent: 'center',
};

const tableRow: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        12,
  padding:    '10px 16px',
};
