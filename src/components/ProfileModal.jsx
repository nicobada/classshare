import { useState } from 'react'
import { signOut, updatePassword, deleteUser } from 'firebase/auth'
import { doc, deleteDoc, updateDoc, increment } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { supabase, STORAGE_BUCKET } from '../supabase'
import { fmtSize, fmtDate, avatarColor, initials } from '../utils/fileHelpers'
import { logAuditEvent } from '../utils/auditLogger'

/**
 * User profile management modal allowing password changes, file history review,
 * and GDPR-compliant self-service account deletion (Right to Erasure).
 * @param {{ user: object, profile: object, files: Array, onClose: () => void }} props
 */
export default function ProfileModal({ user, profile, files, onClose }) {
  const myFiles = files.filter(f => f.uploadedBy === user.uid)
  const [showPwd, setShowPwd] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  // GDPR Account Deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleChangePwd = async () => {
    setPwdMsg('')
    setPwdError('')
    if (newPwd.length < 6) {
      setPwdError('Minimo 6 caratteri.')
      return
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Le password non coincidono.')
      return
    }
    setPwdLoading(true)
    try {
      await updatePassword(user, newPwd)
      setPwdMsg('Password aggiornata con successo!')
      setNewPwd('')
      setConfirmPwd('')
      setTimeout(() => setShowPwd(false), 1500)
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        setPwdError('Sessione scaduta. Esci e rientra, poi riprova.')
      } else {
        setPwdError('Errore: ' + err.message)
      }
    }
    setPwdLoading(false)
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    setDeleteError('')

    try {
      // 1. Delete all user files from Supabase Storage
      const paths = myFiles.filter(f => f.storagePath).map(f => f.storagePath)
      if (paths.length > 0) {
        await supabase.storage.from(STORAGE_BUCKET).remove(paths)
      }

      // 2. Cascade delete file documents from Firestore
      for (const f of myFiles) {
        if (f.projectId) {
          try {
            await updateDoc(doc(db, 'projects', f.projectId), { fileCount: increment(-1) })
          } catch {
            // Ignore if project was already deleted
          }
        }
        await deleteDoc(doc(db, 'files', f.id))
      }

      // 3. Log GDPR account deletion event before profile deletion
      await logAuditEvent({
        action: 'GDPR_FORGOTTEN',
        actorName: profile?.name || user.email,
        actorEmail: user.email,
        details: `Esercitato diritto all'oblio (Art. 17 GDPR): rimossi profilo e ${myFiles.length} file dallo storage`
      })

      // 4. Delete user profile document from Firestore
      await deleteDoc(doc(db, 'profiles', user.uid))

      // 5. Delete user account from Firebase Authentication
      await deleteUser(user)

      onClose()
    } catch (err) {
      console.error('Account deletion error:', err)
      if (err.code === 'auth/requires-recent-login') {
        setDeleteError('Per sicurezza, questa operazione richiede una sessione recente. Esci dall\'account, riaccedi e riprova.')
      } else {
        setDeleteError('Errore durante la cancellazione: ' + err.message)
      }
      setDeleteLoading(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.baseModal}>
        <div style={s.header}>
          <p style={s.title}>Il mio profilo</p>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        <div style={s.profileHeader}>
          <div style={{ ...s.bigAvatar, background: avatarColor(profile?.name || user?.email) }}>
            {initials(profile?.name || user?.email)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '18px', fontWeight: '600', color: '#e8e6e0' }}>
              {profile?.name || 'Utente'}
            </p>
            <p style={{ fontSize: '13px', color: '#6b6b75', marginTop: '3px' }}>{user.email}</p>
            <p style={{ fontSize: '13px', color: '#a99bfc', marginTop: '6px' }}>
              {myFiles.length} file caricati
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            style={s.btnOutline}
            onClick={() => { setShowPwd(v => !v); setPwdMsg(''); setPwdError('') }}
          >
            {showPwd ? 'Annulla' : '🔑 Cambia password'}
          </button>
          <button
            style={s.btnLogout}
            onClick={() => { signOut(auth); onClose() }}
          >
            ↩ Esci dall'account
          </button>
        </div>

        {showPwd && (
          <div style={s.pwdBox}>
            <input
              style={s.inputDark}
              type="password"
              placeholder="Nuova password (min 6 caratteri)"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
            />
            <input
              style={s.inputDark}
              type="password"
              placeholder="Conferma nuova password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
            />
            {pwdError && <p style={{ fontSize: '12px', color: '#f87171', margin: 0 }}>{pwdError}</p>}
            {pwdMsg && <p style={{ fontSize: '12px', color: '#34d399', margin: 0 }}>{pwdMsg}</p>}
            <button
              style={pwdLoading ? s.btnDisabled : s.btn}
              onClick={handleChangePwd}
              disabled={pwdLoading}
            >
              {pwdLoading ? 'Salvataggio...' : 'Salva nuova password'}
            </button>
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <p style={s.sectionTitle}>I miei file ({myFiles.length})</p>
          {myFiles.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#6b6b75' }}>Nessun file caricato ancora.</p>
          ) : (
            <div style={s.fileList}>
              {myFiles.map(f => (
                <div key={f.id} style={s.fileRow}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={s.fileName}>{f.name}</p>
                    <p style={s.fileMeta}>{fmtSize(f.size)} · {fmtDate(f.createdAt)}</p>
                  </div>
                  <span style={s.categoryBadge}>{f.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GDPR Privacy & Account Deletion Section */}
        <div style={s.gdprSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '12px', fontWeight: '500', color: '#9b9ba8' }}>
                🛡️ Diritto all'oblio (GDPR Art. 17)
              </p>
              <p style={{ fontSize: '11px', color: '#4a4a55', marginTop: '2px' }}>
                Puoi cancellare definitivamente il tuo account e tutti i tuoi file dal cloud.
              </p>
            </div>
            {!showDeleteConfirm && (
              <button
                style={s.btnDangerOutline}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Elimina account
              </button>
            )}
          </div>

          {showDeleteConfirm && (
            <div style={s.deleteConfirmBox}>
              <p style={{ fontSize: '12px', color: '#f87171', fontWeight: '500' }}>
                Confermi l'eliminazione definitiva?
              </p>
              <p style={{ fontSize: '11px', color: '#9b9ba8', marginTop: '4px', lineHeight: '1.4' }}>
                Questa azione eliminerà irrevocabilmente il tuo account, il tuo profilo e tutti i {myFiles.length} file caricati dallo storage.
              </p>
              {deleteError && (
                <p style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>
                  {deleteError}
                </p>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  style={s.btnSecondary}
                  onClick={() => { setShowDeleteConfirm(false); setDeleteError('') }}
                  disabled={deleteLoading}
                >
                  Annulla
                </button>
                <button
                  style={s.btnDangerSolid}
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Cancellazione in corso...' : 'Sì, elimina tutto'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '1rem'
  },
  baseModal: {
    background: '#17171a',
    border: '1px solid #2a2a2f',
    borderRadius: '16px',
    padding: '1.75rem',
    width: '100%',
    maxWidth: '520px',
    maxHeight: '90vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #1e1e23',
    paddingBottom: '0.75rem'
  },
  title: { fontSize: '16px', fontWeight: '600', color: '#e8e6e0' },
  close: {
    background: 'none',
    border: 'none',
    color: '#6b6b75',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
    borderRadius: '6px'
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '1.25rem 0',
    borderBottom: '1px solid #1e1e23'
  },
  bigAvatar: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: '500',
    color: '#fff',
    flexShrink: 0
  },
  btnOutline: {
    flex: 1,
    padding: '9px 14px',
    border: '1px solid #2a2a2f',
    borderRadius: '8px',
    background: 'transparent',
    color: '#9b9ba8',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif'
  },
  btnLogout: {
    flex: 1,
    padding: '9px 14px',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: '8px',
    background: 'rgba(248,113,113,0.08)',
    color: '#f87171',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif'
  },
  pwdBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '14px',
    padding: '14px',
    background: '#0e0e10',
    borderRadius: '10px'
  },
  inputDark: {
    background: '#17171a',
    border: '1px solid #2a2a2f',
    borderRadius: '8px',
    padding: '9px 12px',
    color: '#e8e6e0',
    fontSize: '13px',
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none'
  },
  btn: {
    padding: '10px',
    border: 'none',
    borderRadius: '8px',
    background: '#7c6dfa',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif'
  },
  btnDisabled: {
    padding: '10px',
    border: 'none',
    borderRadius: '8px',
    background: '#3d3860',
    color: '#9b9ba8',
    fontSize: '13px',
    cursor: 'not-allowed',
    fontFamily: 'DM Sans, sans-serif'
  },
  sectionTitle: {
    fontSize: '11px',
    color: '#4a4a55',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '10px'
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '180px',
    overflowY: 'auto'
  },
  fileRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#0e0e10',
    borderRadius: '8px'
  },
  fileName: {
    fontSize: '13px',
    color: '#e8e6e0',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  fileMeta: { fontSize: '11px', color: '#4a4a55', marginTop: '2px' },
  categoryBadge: {
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '20px',
    background: 'rgba(124,109,250,0.12)',
    color: '#a99bfc',
    flexShrink: 0
  },
  gdprSection: {
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #1e1e23'
  },
  btnDangerOutline: {
    padding: '6px 12px',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: '6px',
    background: 'transparent',
    color: '#f87171',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif'
  },
  deleteConfirmBox: {
    marginTop: '12px',
    padding: '12px',
    background: '#201010',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: '8px'
  },
  btnSecondary: {
    padding: '6px 12px',
    border: '1px solid #2a2a2f',
    borderRadius: '6px',
    background: 'transparent',
    color: '#9b9ba8',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif'
  },
  btnDangerSolid: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: '6px',
    background: '#dc2626',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif'
  }
}
