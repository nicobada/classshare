import { useState, useRef, useEffect } from 'react'
import { supabase, STORAGE_BUCKET } from '../supabase'
import {
  collection, addDoc, getDocs, serverTimestamp,
  doc, updateDoc, increment, query, where, orderBy
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = ['Codice', 'Documenti', 'Immagini', 'Altro']
const LANGUAGES = ['js','jsx','ts','tsx','html','css','php','py','java','c','cpp','json','sql','sh','md','txt','vue','xml']

/**
 * Loads all files uploaded by the current user, excluding those
 * already assigned to the target project.
 * @param {string} userId - The current user's UID.
 * @param {string} excludeProjectId - Files already in this project are excluded.
 * @returns {Promise<Array>} Array of file objects available for assignment.
 */
async function fetchAssignableUserFiles(userId, excludeProjectId) {
  const snap = await getDocs(
    query(collection(db, 'files'), where('uploadedBy', '==', userId), orderBy('createdAt', 'desc'))
  )
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(f => f.projectId !== excludeProjectId)
}

/**
 * Loads all projects created by the current user.
 * @param {string} userId - The current user's UID.
 * @returns {Promise<Array>} Array of project objects.
 */
async function fetchUserProjects(userId) {
  const snap = await getDocs(
    query(collection(db, 'projects'), where('createdBy', '==', userId), orderBy('createdAt', 'desc'))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Assigns an existing file to a project by updating its projectId field.
 * @param {string} fileId - Firestore document ID of the file.
 * @param {string} targetProjectId - The project to link the file to.
 * @returns {Promise<void>}
 * @example assignFileToProject('abc123', 'proj456')
 */
async function assignFileToProject(fileId, targetProjectId) {
  await updateDoc(doc(db, 'files', fileId), { projectId: targetProjectId })
  await updateDoc(doc(db, 'projects', targetProjectId), { fileCount: increment(1) })
}

export default function UploadModal({ onClose, onSuccess, defaultProjectId = null }) {
  const { user, profile } = useAuth()

  // Mode: 'file' | 'code' | 'existing'
  const [mode, setMode] = useState('file')
  const [newFiles, setNewFiles] = useState([])
  const [category, setCategory] = useState('Codice')
  const [tags, setTags] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState([])
  const [error, setError] = useState('')

  // Code paste state
  const [codeText, setCodeText] = useState('')
  const [codeLang, setCodeLang] = useState('js')
  const [codeName, setCodeName] = useState('')

  // Project assignment state
  const [createProject, setCreateProject] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId)
  const [myProjects, setMyProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  // Existing files state
  const [standaloneFiles, setStandaloneFiles] = useState([])
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [selectedExistingIds, setSelectedExistingIds] = useState(new Set())

  const fileRef = useRef()

  // Load all user files (excluding those already in this project) when tab is opened
  useEffect(() => {
    if (mode === 'existing' && defaultProjectId) {
      setLoadingExisting(true)
      fetchAssignableUserFiles(user.uid, defaultProjectId)
        .then(files => { setStandaloneFiles(files); setLoadingExisting(false) })
        .catch(err => { console.error('Failed to load user files:', err.message); setLoadingExisting(false) })
    }
  }, [mode, defaultProjectId, user.uid])

  const fmt = (b) => {
    if (b < 1024) return b + ' B'
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
    return (b / 1048576).toFixed(1) + ' MB'
  }

  const loadProjects = async () => {
    setLoadingProjects(true)
    const projects = await fetchUserProjects(user.uid)
    setMyProjects(projects)
    setLoadingProjects(false)
  }

  const addNewFiles = (incoming) => {
    const arr = Array.from(incoming)
    setNewFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name))
      return [...prev, ...arr.filter(f => !existingNames.has(f.name))]
    })
  }

  const removeNewFile = (name) => setNewFiles(prev => prev.filter(f => f.name !== name))

  const toggleExistingFile = (fileId) => {
    setSelectedExistingIds(prev => {
      const next = new Set(prev)
      next.has(fileId) ? next.delete(fileId) : next.add(fileId)
      return next
    })
  }

  // Handles uploading brand-new files (from disk)
  const handleUploadNewFiles = async () => {
    if (newFiles.length === 0) { setError('Seleziona almeno un file.'); return }
    setUploading(true); setError('')
    setUploadStatus(newFiles.map(() => 'pending'))

    let finalProjectId = projectId

    // Create a new project if requested
    if (createProject && !defaultProjectId) {
      if (!projectName.trim()) { setError('Dai un nome al progetto.'); setUploading(false); return }
      const projRef = await addDoc(collection(db, 'projects'), {
        name: projectName.trim(),
        description: projectDesc.trim(),
        category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        createdBy: user.uid,
        creatorName: profile?.name || user.email,
        fileCount: 0,
        createdAt: serverTimestamp()
      })
      finalProjectId = projRef.id
    }

    let successCount = 0
    for (let i = 0; i < newFiles.length; i++) {
      setUploadStatus(prev => prev.map((s, idx) => idx === i ? 'uploading' : s))
      try {
        const file = newFiles[i]
        const storageName = `${user.uid}_${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET).upload(storageName, file, { upsert: false })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storageName)
        await addDoc(collection(db, 'files'), {
          name: file.name,
          url: urlData.publicUrl,
          storagePath: storageName,
          size: file.size,
          category,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          uploadedBy: user.uid,
          uploaderName: profile?.name || user.email,
          projectId: finalProjectId || null,
          createdAt: serverTimestamp()
        })
        setUploadStatus(prev => prev.map((s, idx) => idx === i ? 'done' : s))
        successCount++
      } catch {
        setUploadStatus(prev => prev.map((s, idx) => idx === i ? 'error' : s))
      }
    }

    if (finalProjectId) {
      await updateDoc(doc(db, 'projects', finalProjectId), { fileCount: increment(successCount) })
    }
    await updateDoc(doc(db, 'profiles', user.uid), { fileCount: increment(successCount) })

    setUploading(false)
    if (successCount === newFiles.length) { onSuccess(); onClose() }
    else setError(`${newFiles.length - successCount} file non caricati. Gli altri sono stati salvati.`)
  }

  // Handles pasting code as a new file
  const handleUploadCode = async () => {
    if (!codeText.trim()) { setError('Incolla del codice prima.'); return }
    const fileName = (codeName.trim() || 'snippet') + '.' + codeLang
    setUploading(true); setError('')
    try {
      const blob = new Blob([codeText], { type: 'text/plain' })
      const storageName = `${user.uid}_${Date.now()}_${fileName}`
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET).upload(storageName, blob, { upsert: false })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storageName)
      await addDoc(collection(db, 'files'), {
        name: fileName,
        url: urlData.publicUrl,
        storagePath: storageName,
        size: blob.size,
        category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        uploadedBy: user.uid,
        uploaderName: profile?.name || user.email,
        projectId: projectId || null,
        createdAt: serverTimestamp()
      })
      await updateDoc(doc(db, 'profiles', user.uid), { fileCount: increment(1) })
      setUploading(false); onSuccess(); onClose()
    } catch (err) {
      setError('Errore: ' + err.message); setUploading(false)
    }
  }

  // Assigns already-uploaded files to the current project
  const handleAssignExisting = async () => {
    if (selectedExistingIds.size === 0) { setError('Seleziona almeno un file.'); return }
    if (!defaultProjectId) { setError('Nessun progetto di destinazione.'); return }
    setUploading(true); setError('')
    try {
      for (const fileId of selectedExistingIds) {
        await assignFileToProject(fileId, defaultProjectId)
      }
      setUploading(false); onSuccess(); onClose()
    } catch (err) {
      setError('Errore: ' + err.message); setUploading(false)
    }
  }

  const statusIcon = (st) => ({ done: '✓', error: '✕', uploading: '↑', pending: '○' })[st] ?? '○'
  const statusColor = (st) => ({ done: '#34d399', error: '#f87171', uploading: '#a99bfc' })[st] ?? '#4a4a55'

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>{defaultProjectId ? 'Aggiungi al progetto' : 'Condividi con la classe'}</span>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        {/* Mode tabs — show "File esistenti" only when adding to a project */}
        <div style={s.modeTabs}>
          <button style={mode === 'file' ? s.modeActive : s.modeTab} onClick={() => { setMode('file'); setError('') }}>
            📁 Carica file
          </button>
          <button style={mode === 'code' ? s.modeActive : s.modeTab} onClick={() => { setMode('code'); setError('') }}>
            {'</>'} Incolla codice
          </button>
          {defaultProjectId && (
            <button style={mode === 'existing' ? s.modeActive : s.modeTab} onClick={() => { setMode('existing'); setError('') }}>
              🔗 File esistenti
            </button>
          )}
        </div>

        {/* ── NEW FILE UPLOAD ── */}
        {mode === 'file' && (
          <div>
            <div style={s.dropzone} onClick={() => fileRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); addNewFiles(e.dataTransfer.files) }}>
              <input ref={fileRef} type="file" style={{ display: 'none' }} multiple
                onChange={e => addNewFiles(e.target.files)} />
              {newFiles.length === 0 ? (
                <div>
                  <p style={s.dropText}>Trascina qui o clicca per scegliere</p>
                  <p style={s.dropSub}>Puoi selezionare più file insieme</p>
                </div>
              ) : (
                <p style={{ color: '#6b6b75', fontSize: '13px' }}>+ Aggiungi altri file</p>
              )}
            </div>

            {newFiles.length > 0 && (
              <div style={s.fileList}>
                {newFiles.map((f, i) => (
                  <div key={f.name} style={s.fileRow}>
                    <span style={{ fontSize: '12px', color: statusColor(uploadStatus[i]), minWidth: '16px' }}>
                      {statusIcon(uploadStatus[i])}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', color: '#e8e6e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</p>
                      <p style={{ fontSize: '11px', color: '#4a4a55' }}>{fmt(f.size)}</p>
                    </div>
                    {!uploading && <button style={s.removeBtn} onClick={() => removeNewFile(f.name)}>✕</button>}
                  </div>
                ))}
                <p style={{ fontSize: '12px', color: '#4a4a55', marginTop: '4px' }}>
                  {newFiles.length} file · {fmt(newFiles.reduce((a, f) => a + f.size, 0))} totali
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── CODE PASTE ── */}
        {mode === 'code' && (
          <div style={s.codeSection}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Nome file <span style={s.optional}>(senza estensione)</span></label>
                <input style={{ ...s.input, marginTop: '6px' }} placeholder="es. todo-app"
                  value={codeName} onChange={e => setCodeName(e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Linguaggio</label>
                <select style={{ ...s.input, marginTop: '6px', width: '90px' }}
                  value={codeLang} onChange={e => setCodeLang(e.target.value)}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <textarea style={s.codeEditor} placeholder="Incolla il tuo codice qui..."
              value={codeText} onChange={e => setCodeText(e.target.value)} spellCheck={false} />
            {codeText && (
              <p style={{ fontSize: '11px', color: '#4a4a55', marginTop: '4px' }}>
                {codeText.split('\n').length} righe · {fmt(new Blob([codeText]).size)}
              </p>
            )}
          </div>
        )}

        {/* ── EXISTING FILES ── */}
        {mode === 'existing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '12px', color: '#6b6b75' }}>
              Seleziona i tuoi file già caricati da aggiungere a questo progetto.
            </p>
            {loadingExisting ? (
              <p style={{ fontSize: '13px', color: '#6b6b75' }}>Caricamento...</p>
            ) : standaloneFiles.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#6b6b75' }}>Nessun file disponibile.</p>
            ) : (
              <div style={{ ...s.fileList, maxHeight: '220px', overflowY: 'auto' }}>
                {standaloneFiles.map(f => {
                  const selected = selectedExistingIds.has(f.id)
                  return (
                    <div key={f.id}
                      style={{ ...s.fileRow, cursor: 'pointer', border: selected ? '1px solid #7c6dfa' : '1px solid transparent', borderRadius: '8px' }}
                      onClick={() => toggleExistingFile(f.id)}>
                      <span style={{ fontSize: '14px', color: selected ? '#a99bfc' : '#4a4a55', minWidth: '18px' }}>
                        {selected ? '☑' : '☐'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', color: '#e8e6e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</p>
                        <p style={{ fontSize: '11px', color: '#4a4a55' }}>
                          {fmt(f.size)} · {f.category}
                          {/* Show which project this file currently belongs to */}
                          {f.projectId && <span style={{ color: '#7c6dfa', marginLeft: '6px' }}>· già in un progetto</span>}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {selectedExistingIds.size > 0 && (
              <p style={{ fontSize: '12px', color: '#a99bfc' }}>{selectedExistingIds.size} file selezionati</p>
            )}
          </div>
        )}

        {/* ── PROJECT SELECTOR (only for new files/code, not existing) ── */}
        {mode !== 'existing' && !defaultProjectId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: '#0e0e10', borderRadius: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button style={{ ...s.toggleBtn, ...(createProject ? s.toggleActive : {}) }}
                onClick={() => { setCreateProject(true); setProjectId(null) }}>
                📁 Nuovo progetto
              </button>
              <button style={{ ...s.toggleBtn, ...(!createProject && projectId ? s.toggleInfo : {}) }}
                onClick={() => { setCreateProject(false); loadProjects() }}>
                + Aggiungi a esistente
              </button>
              <button style={s.toggleBtn}
                onClick={() => { setCreateProject(false); setProjectId(null); setMyProjects([]) }}>
                Nessun progetto
              </button>
            </div>

            {createProject && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input style={s.input} placeholder="Nome progetto *" value={projectName} onChange={e => setProjectName(e.target.value)} />
                <input style={s.input} placeholder="Descrizione (opzionale)" value={projectDesc} onChange={e => setProjectDesc(e.target.value)} />
              </div>
            )}

            {!createProject && myProjects.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                {loadingProjects
                  ? <p style={{ fontSize: '13px', color: '#6b6b75' }}>Caricamento...</p>
                  : myProjects.map(p => (
                    <div key={p.id} onClick={() => setProjectId(p.id)}
                      style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', background: projectId === p.id ? 'rgba(124,109,250,0.15)' : '#17171a', border: projectId === p.id ? '1px solid #7c6dfa' : '1px solid #2a2a2f' }}>
                      <p style={{ fontSize: '13px', color: projectId === p.id ? '#a99bfc' : '#e8e6e0', fontWeight: '500' }}>{p.name}</p>
                      <p style={{ fontSize: '11px', color: '#4a4a55', marginTop: '2px' }}>{p.fileCount} file</p>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* Category + tags (not shown in existing mode) */}
        {mode !== 'existing' && (
          <>
            <div style={s.field}>
              <label style={s.label}>Categoria</label>
              <div style={s.cats}>
                {CATEGORIES.map(c => (
                  <button key={c} style={category === c ? s.catActive : s.cat} onClick={() => setCategory(c)}>{c}</button>
                ))}
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Tag <span style={s.optional}>(separati da virgola)</span></label>
              <input style={s.input} placeholder="es. react, homework, settimana3"
                value={tags} onChange={e => setTags(e.target.value)} />
            </div>
          </>
        )}

        {error && <p style={s.error}>{error}</p>}

        <div style={s.actions}>
          <button style={s.btnSecondary} onClick={onClose}>Annulla</button>
          <button
            style={uploading ? s.btnDisabled : s.btn}
            disabled={uploading}
            onClick={
              mode === 'existing' ? handleAssignExisting
                : mode === 'code' ? handleUploadCode
                  : handleUploadNewFiles
            }>
            {uploading
              ? `Caricamento ${uploadStatus.filter(s => s === 'done').length}/${mode === 'file' ? newFiles.length : 1}...`
              : mode === 'existing'
                ? `Aggiungi ${selectedExistingIds.size || ''} file`
                : mode === 'file'
                  ? (newFiles.length > 1 ? `Carica ${newFiles.length} file` : 'Carica file')
                  : 'Condividi codice'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' },
  modal: { background: '#17171a', border: '1px solid #2a2a2f', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '540px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '16px', fontWeight: '600', color: '#e8e6e0' },
  close: { background: 'none', border: 'none', color: '#6b6b75', cursor: 'pointer', fontSize: '16px', padding: '4px 8px', borderRadius: '6px' },
  modeTabs: { display: 'flex', gap: '4px', background: '#0e0e10', borderRadius: '8px', padding: '4px' },
  modeTab: { flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'transparent', color: '#6b6b75', fontSize: '12px', fontFamily: 'DM Sans,sans-serif' },
  modeActive: { flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: '#7c6dfa', color: '#fff', fontSize: '12px', fontWeight: '500', fontFamily: 'DM Sans,sans-serif' },
  dropzone: { border: '1.5px dashed #2a2a2f', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer' },
  dropText: { color: '#9b9ba8', fontSize: '14px' },
  dropSub: { color: '#4a4a55', fontSize: '12px', marginTop: '4px' },
  fileList: { marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' },
  fileRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#0e0e10', borderRadius: '8px' },
  removeBtn: { background: 'none', border: 'none', color: '#4a4a55', cursor: 'pointer', fontSize: '12px', padding: '2px 6px', flexShrink: 0 },
  codeSection: { display: 'flex', flexDirection: 'column' },
  codeEditor: { background: '#0e0e10', border: '1px solid #2a2a2f', borderRadius: '8px', padding: '12px', color: '#e8e6e0', fontSize: '13px', fontFamily: 'DM Mono,monospace', outline: 'none', resize: 'vertical', minHeight: '150px', lineHeight: '1.6' },
  toggleBtn: { padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontFamily: 'DM Sans,sans-serif', border: '1px solid #2a2a2f', background: 'transparent', color: '#6b6b75' },
  toggleActive: { border: '1px solid #7c6dfa', background: 'rgba(124,109,250,0.15)', color: '#a99bfc' },
  toggleInfo: { border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.1)', color: '#7dd3fc' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '13px', color: '#9b9ba8', fontWeight: '500' },
  optional: { color: '#4a4a55', fontWeight: '400' },
  cats: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  cat: { padding: '6px 14px', borderRadius: '20px', border: '1px solid #2a2a2f', background: 'transparent', color: '#6b6b75', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' },
  catActive: { padding: '6px 14px', borderRadius: '20px', border: '1px solid #7c6dfa', background: 'rgba(124,109,250,0.15)', color: '#a99bfc', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' },
  input: { background: '#17171a', border: '1px solid #2a2a2f', borderRadius: '8px', padding: '10px 14px', color: '#e8e6e0', fontSize: '13px', fontFamily: 'DM Sans,sans-serif', outline: 'none' },
  error: { fontSize: '13px', color: '#f87171', background: '#2a1515', borderRadius: '8px', padding: '10px 14px' },
  actions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  btnSecondary: { padding: '10px 20px', border: '1px solid #2a2a2f', borderRadius: '8px', background: 'transparent', color: '#9b9ba8', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' },
  btn: { padding: '10px 24px', border: 'none', borderRadius: '8px', background: '#7c6dfa', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' },
  btnDisabled: { padding: '10px 24px', border: 'none', borderRadius: '8px', background: '#3d3860', color: '#9b9ba8', fontSize: '14px', cursor: 'not-allowed', fontFamily: 'DM Sans,sans-serif' }
}
