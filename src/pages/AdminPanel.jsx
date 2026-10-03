import { useState } from 'react'
import {
  collection, getDocs, deleteDoc, doc,
  query, orderBy, updateDoc, increment
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import { supabase, STORAGE_BUCKET } from '../supabase'
import { sendPasswordResetEmail } from 'firebase/auth'

import { useEffect } from 'react'
/** @param {number} b - bytes */
function fmtSize(b) {
  if (!b) return '0 B'
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

/** @param {import('firebase/firestore').Timestamp} ts */
function fmtDate(ts) {
  if (!ts) return ''
  return ts.toDate().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminPanel({ onClose }) {
  const [tab, setTab] = useState('files')
  const [files, setFiles] = useState([])
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('ok')

  // State for the "assign file to project" workflow
  const [assigningFile, setAssigningFile] = useState(null)
  const [selectedProjectId, setSelectedProjectId] = useState('')

  // State for the "rename project" workflow
  const [editingProject, setEditingProject] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const notify = (text, type = 'ok') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      setLoading(true)
      try {
        const [fSnap, uSnap, pSnap] = await Promise.all([
          getDocs(query(collection(db, 'files'), orderBy('createdAt', 'desc'))),
          getDocs(collection(db, 'profiles')),
          getDocs(query(collection(db, 'projects'), orderBy('createdAt', 'desc')))
        ])
        if (!mounted) return
        setFiles(fSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setProjects(pSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        if (mounted) notify('Errore nel caricamento dati: ' + err.message, 'err')
      }
      if (mounted) setLoading(false)
    }
    loadData()
    return () => { mounted = false }
  }, [])

  const deleteFile = async (file) => {
    if (!confirm(`Eliminare "${file.name}"?`)) return
    try { if (file.storagePath) await supabase.storage.from(STORAGE_BUCKET).remove([file.storagePath]) } catch (err) {
      console.error('Storage delete error:', err.message)
    }
    await deleteDoc(doc(db, 'files', file.id))
    setFiles(prev => prev.filter(x => x.id !== file.id))
    notify('File eliminato.')
  }

  const deleteAllFiles = async () => {
    if (!confirm(`Eliminare TUTTI i ${files.length} file? Operazione irreversibile.`)) return
    setLoading(true)
    const paths = files.filter(f => f.storagePath).map(f => f.storagePath)
    if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths)
    for (const f of files) await deleteDoc(doc(db, 'files', f.id))
    setFiles([])
    setLoading(false)
    notify('Tutti i file eliminati.')
  }

  const sendReset = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email)
      notify(`Email di reset inviata a ${email}`)
    } catch (err) {
      notify('Errore: ' + err.message, 'err')
    }
  }

  const deleteUser = async (u) => {
    if (!confirm(`Eliminare l'account di ${u.name} (${u.email}) e tutti i suoi file? Operazione irreversibile.`)) return
    setLoading(true)
    try {
      const userFiles = files.filter(f => f.uploadedBy === u.id)
      const paths = userFiles.filter(f => f.storagePath).map(f => f.storagePath)
      if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths)
      for (const f of userFiles) await deleteDoc(doc(db, 'files', f.id))
      await deleteDoc(doc(db, 'profiles', u.id))
      setUsers(prev => prev.filter(x => x.id !== u.id))
      setFiles(prev => prev.filter(f => f.uploadedBy !== u.id))
      notify(`Account di ${u.name} eliminato. Lo studente può re-registrarsi con una nuova email.`)
    } catch (err) {
      notify('Errore: ' + err.message, 'err')
    }
    setLoading(false)
  }

  /**
   * Assigns a file to a project chosen by the admin.
   * Removes from old project count if previously assigned.
   * @param {object} file - The file to reassign.
   * @param {string} targetProjectId - Destination project ID.
   */
  const assignFileToProject = async (file, targetProjectId) => {
    if (!targetProjectId) { notify('Seleziona un progetto.', 'err'); return }
    try {
      if (file.projectId && file.projectId !== targetProjectId) {
        await updateDoc(doc(db, 'projects', file.projectId), { fileCount: increment(-1) })
      }
      await updateDoc(doc(db, 'files', file.id), { projectId: targetProjectId })
      await updateDoc(doc(db, 'projects', targetProjectId), { fileCount: increment(1) })
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, projectId: targetProjectId } : f))
      setAssigningFile(null)
      setSelectedProjectId('')
      notify('File assegnato al progetto.')
    } catch (err) {
      notify('Errore: ' + err.message, 'err')
    }
  }

  const removeFromProject = async (file) => {
    if (!confirm(`Rimuovere "${file.name}" dal suo progetto?`)) return
    try {
      if (file.projectId) {
        await updateDoc(doc(db, 'projects', file.projectId), { fileCount: increment(-1) })
      }
      await updateDoc(doc(db, 'files', file.id), { projectId: null })
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, projectId: null } : f))
      notify('File rimosso dal progetto.')
    } catch (err) {
      notify('Errore: ' + err.message, 'err')
    }
  }

  /**
   * Renames a project by updating its name and optional description in Firestore.
   * @param {string} projectId - The Firestore document ID of the project.
   * @param {string} newName - The new project name.
   * @param {string} newDesc - The new project description.
   */
  const renameProject = async (projectId, newName, newDesc) => {
    if (!newName.trim()) { notify('Il nome non può essere vuoto.', 'err'); return }
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        name: newName.trim(),
        description: newDesc.trim()
      })
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: newName.trim(), description: newDesc.trim() } : p))
      setEditingProject(null)
      notify('Progetto rinominato.')
    } catch (err) {
      notify('Errore: ' + err.message, 'err')
    }
  }

  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0)


  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>
        <div style={s.header}>
          <p style={s.title}>Pannello Admin</p>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        <div style={s.stats}>
          <div style={s.stat}><p style={s.statVal}>{files.length}</p><p style={s.statLbl}>File totali</p></div>
          <div style={s.stat}><p style={s.statVal}>{users.length}</p><p style={s.statLbl}>Utenti</p></div>
          <div style={s.stat}><p style={s.statVal}>{fmtSize(totalSize)}</p><p style={s.statLbl}>Spazio usato</p></div>
        </div>

        {msg && (
          <p style={{ ...s.msgBox, background: msgType === 'err' ? '#2a1515' : '#0f2a1a', color: msgType === 'err' ? '#f87171' : '#34d399' }}>
            {msg}
          </p>
        )}

        <div style={s.tabs}>
          <button style={tab === 'files' ? s.tabActive : s.tabBtn} onClick={() => setTab('files')}>File ({files.length})</button>
          <button style={tab === 'users' ? s.tabActive : s.tabBtn} onClick={() => setTab('users')}>Utenti ({users.length})</button>
          <button style={tab === 'projects' ? s.tabActive : s.tabBtn} onClick={() => setTab('projects')}>Progetti ({projects.length})</button>
        </div>

        {loading ? (
          <p style={{ fontSize: '13px', color: '#6b6b75', padding: '1rem 0' }}>Caricamento...</p>

        ) : tab === 'files' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
            {files.length > 0 && (
              <button style={s.btnDanger} onClick={deleteAllFiles}>
                Elimina tutti i file ({files.length})
              </button>
            )}
            <div style={s.list}>
              {files.length === 0
                ? <p style={{ fontSize: '13px', color: '#6b6b75' }}>Nessun file.</p>
                : files.map(f => (
                  <div key={f.id} style={s.row}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={s.rowName}>{f.name}</p>
                      <p style={s.rowMeta}>
                        {fmtSize(f.size)} · {f.uploaderName} · {fmtDate(f.createdAt)}
                        {f.projectId && <span style={{ color: '#a99bfc', marginLeft: '6px' }}>
                          · 📁 {projects.find(p => p.id === f.projectId)?.name || 'Progetto'}
                        </span>}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      <button style={s.btnSmallOutline} onClick={() => { setAssigningFile(f); setSelectedProjectId(f.projectId || '') }}>
                        📁
                      </button>
                      <button style={s.btnSmallDanger} onClick={() => deleteFile(f)}>✕</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

        ) : tab === 'users' ? (
          <div style={s.list}>
            {users.length === 0
              ? <p style={{ fontSize: '13px', color: '#6b6b75' }}>Nessun utente.</p>
              : users.map(u => (
                <div key={u.id} style={s.row}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={s.rowName}>{u.name}</p>
                    <p style={s.rowMeta}>{u.email} · {u.fileCount || 0} file caricati</p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button style={s.btnSmallOutline} onClick={() => sendReset(u.email)}>Reset pwd</button>
                    <button style={s.btnSmallDanger} onClick={() => deleteUser(u)} title="Elimina account">✕</button>
                  </div>
                </div>
              ))
            }
          </div>

        ) : (
          <div style={s.list}>
            {projects.length === 0
              ? <p style={{ fontSize: '13px', color: '#6b6b75' }}>Nessun progetto.</p>
              : projects.map(p => {
                const projectFiles = files.filter(f => f.projectId === p.id)
                const isEditing = editingProject === p.id
                return (
                  <div key={p.id} style={{ ...s.row, flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                    {isEditing ? (
                      // Inline rename form
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input style={s.input} value={editName}
                          onChange={e => setEditName(e.target.value)}
                          placeholder="Nome progetto" autoFocus />
                        <input style={s.input} value={editDesc}
                          onChange={e => setEditDesc(e.target.value)}
                          placeholder="Descrizione (opzionale)" />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button style={s.btnSecondary} onClick={() => setEditingProject(null)}>Annulla</button>
                          <button style={s.btn} onClick={() => renameProject(p.id, editName, editDesc)}>Salva</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={s.rowName}>📁 {p.name}</p>
                          <p style={s.rowMeta}>{p.creatorName} · {projectFiles.length} file</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button style={s.btnSmallOutline} onClick={() => {
                            setEditingProject(p.id)
                            setEditName(p.name)
                            setEditDesc(p.description || '')
                          }}>✎ Rinomina</button>
                          <button style={s.btnSmallDanger} title="Elimina progetto e tutti i suoi file"
                            onClick={async () => {
                              if (!confirm(`Eliminare il progetto "${p.name}" e tutti i suoi ${projectFiles.length} file?`)) return
                              try {
                                const paths = projectFiles.filter(f => f.storagePath).map(f => f.storagePath)
                                if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths)
                                for (const f of projectFiles) await deleteDoc(doc(db, 'files', f.id))
                                await deleteDoc(doc(db, 'projects', p.id))
                                setProjects(prev => prev.filter(x => x.id !== p.id))
                                setFiles(prev => prev.filter(f => f.projectId !== p.id))
                                notify(`Progetto "${p.name}" eliminato.`)
                              } catch (err) {
                                notify('Errore: ' + err.message, 'err')
                              }
                            }}>✕</button>
                        </div>
                      </div>
                    )}
                    {!isEditing && projectFiles.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '12px', borderLeft: '2px solid #2a2a2f' }}>
                        {projectFiles.map(f => (
                          <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ fontSize: '12px', color: '#9b9ba8' }}>
                              {f.name} <span style={{ color: '#4a4a55' }}>· {f.uploaderName}</span>
                            </p>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button style={{ ...s.btnSmallOutline, fontSize: '11px', padding: '3px 8px' }}
                                onClick={() => removeFromProject(f)}>
                                Rimuovi
                              </button>
                              <button style={s.btnSmallDanger} onClick={() => deleteFile(f)} title="Elimina file">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            }
          </div>
        )}

        {/* Assign file to project — inline modal */}
        {assigningFile && (
          <div style={s.assignBox}>
            <p style={{ fontSize: '13px', fontWeight: '500', color: '#e8e6e0', marginBottom: '10px' }}>
              Assegna "{assigningFile.name}" a un progetto
            </p>
            <select style={{ ...s.input, marginBottom: '10px' }}
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}>
              <option value="">— Seleziona progetto —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.creatorName})</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={s.btnSecondary} onClick={() => { setAssigningFile(null); setSelectedProjectId('') }}>Annulla</button>
              <button style={s.btn} onClick={() => assignFileToProject(assigningFile, selectedProjectId)}>Assegna</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  panel: { background: '#17171a', border: '1px solid #2a2a2f', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '16px', fontWeight: '600', color: '#e8e6e0' },
  close: { background: 'none', border: 'none', color: '#6b6b75', cursor: 'pointer', fontSize: '16px', padding: '4px 8px', borderRadius: '6px' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' },
  stat: { background: '#0e0e10', borderRadius: '8px', padding: '12px', textAlign: 'center' },
  statVal: { fontSize: '20px', fontWeight: '600', color: '#e8e6e0' },
  statLbl: { fontSize: '11px', color: '#4a4a55', marginTop: '3px' },
  msgBox: { fontSize: '13px', borderRadius: '8px', padding: '10px 14px' },
  tabs: { display: 'flex', gap: '4px', background: '#0e0e10', borderRadius: '8px', padding: '4px' },
  tabBtn: { flex: 1, padding: '7px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'transparent', color: '#6b6b75', fontSize: '12px', fontFamily: 'DM Sans,sans-serif' },
  tabActive: { flex: 1, padding: '7px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: '#2a2a2f', color: '#e8e6e0', fontSize: '12px', fontWeight: '500', fontFamily: 'DM Sans,sans-serif' },
  list: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px' },
  row: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#0e0e10', borderRadius: '8px' },
  rowName: { fontSize: '13px', fontWeight: '500', color: '#e8e6e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowMeta: { fontSize: '11px', color: '#4a4a55', marginTop: '2px' },
  catPill: { fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(124,109,250,0.12)', color: '#a99bfc', whiteSpace: 'nowrap' },
  input: { background: '#0e0e10', border: '1px solid #2a2a2f', borderRadius: '8px', padding: '10px 14px', color: '#e8e6e0', fontSize: '13px', fontFamily: 'DM Sans,sans-serif', outline: 'none', width: '100%' },
  btn: { padding: '9px 20px', border: 'none', borderRadius: '8px', background: '#7c6dfa', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' },
  btnSecondary: { padding: '9px 16px', border: '1px solid #2a2a2f', borderRadius: '8px', background: 'transparent', color: '#9b9ba8', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' },
  btnDanger: { padding: '9px 16px', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', textAlign: 'left' },
  btnSmallDanger: { width: '28px', height: '28px', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '6px', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', flexShrink: 0 },
  btnSmallOutline: { padding: '5px 10px', border: '1px solid #2a2a2f', borderRadius: '6px', background: 'transparent', color: '#9b9ba8', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', whiteSpace: 'nowrap' },
  assignBox: { background: '#0e0e10', border: '1px solid #2a2a2f', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' },
}
