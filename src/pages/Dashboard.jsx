import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  deleteDoc, doc, updateDoc, increment
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../firebase'
import { supabase, STORAGE_BUCKET } from '../supabase'
import { useAuth } from '../context/AuthContext'
import UploadModal from '../components/UploadModal'
import AdminPanel from './AdminPanel'
import PreviewModal from '../components/PreviewModal'
import EditModal from '../components/EditModal'
import ProfileModal from '../components/ProfileModal'
import PrivacyModal from '../components/PrivacyModal'
import {
  NAV_ITEMS, CODE_EXTS, IMAGE_EXTS, CAT_COLORS, EXT_LABELS,
  getExt, fmtSize, fmtDate, initials, avatarColor, forceDownload
} from '../utils/fileHelpers'

export default function Dashboard() {
  const { user, profile, isAdmin } = useAuth()
  const [files, setFiles] = useState([])
  const [projects, setProjects] = useState([])
  const [expandedProject, setExpandedProject] = useState(null)
  const [addToProject, setAddToProject] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Tutti')
  const [showUpload, setShowUpload] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [editFile, setEditFile] = useState(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'files'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  const projectFiles = (projectId) => files.filter(f => f.projectId === projectId)
  const standaloneFiles = files.filter(f => !f.projectId)

  const filtered = standaloneFiles.filter(f => {
    const matchCat = category === 'Tutti' || category === 'Progetti' || f.category === category
    const matchSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase())) ||
      f.uploaderName?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const filteredProjects = projects.filter(p => {
    if (category !== 'Tutti' && category !== 'Progetti') return false
    return (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.creatorName?.toLowerCase().includes(search.toLowerCase())
    )
  })

  const handleDelete = async (file) => {
    if (!confirm(`Eliminare "${file.name}"?`)) return
    try {
      if (file.storagePath) await supabase.storage.from(STORAGE_BUCKET).remove([file.storagePath])
    } catch (err) {
      console.error('Storage deletion error:', err)
    }
    if (file.projectId) {
      await updateDoc(doc(db, 'projects', file.projectId), { fileCount: increment(-1) })
    }
    await deleteDoc(doc(db, 'files', file.id))
  }

  const handleDeleteProject = async (project) => {
    if (!confirm(`Eliminare il progetto "${project.name}" e tutti i suoi file?`)) return
    const pFiles = projectFiles(project.id)
    const paths = pFiles.filter(f => f.storagePath).map(f => f.storagePath)
    if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths)
    for (const f of pFiles) await deleteDoc(doc(db, 'files', f.id))
    await deleteDoc(doc(db, 'projects', project.id))
  }

  return (
    <div style={{ ...s.page, flexDirection: isMobile ? 'column' : 'row' }}>
      {/* SIDEBAR desktop / BOTTOM NAV mobile */}
      {isMobile ? (
        <nav style={s.bottomNav}>
          {['Tutti', 'Progetti', 'Codice', 'Documenti'].map(c => (
            <button
              key={c}
              style={category === c ? s.bottomNavActive : s.bottomNavItem}
              onClick={() => setCategory(c)}
            >
              <span style={{ fontSize: '16px' }}>
                {c === 'Tutti' ? '🏠' : c === 'Progetti' ? '📁' : c === 'Codice' ? '💻' : '📄'}
              </span>
              <span style={{ fontSize: '9px' }}>{c}</span>
            </button>
          ))}
          <button style={s.bottomNavItem} onClick={() => setShowUpload(true)}>
            <span style={{ fontSize: '16px' }}>➕</span>
            <span style={{ fontSize: '9px' }}>Carica</span>
          </button>
          <button style={s.bottomNavItem} onClick={() => setShowProfile(true)}>
            <div
              style={{
                ...s.avatar,
                background: avatarColor(profile?.name || user?.email),
                width: '22px',
                height: '22px',
                fontSize: '9px'
              }}
            >
              {initials(profile?.name || user?.email)}
            </div>
            <span style={{ fontSize: '9px' }}>Profilo</span>
          </button>
          {isAdmin && (
            <button style={s.bottomNavItem} onClick={() => setShowAdmin(true)}>
              <span style={{ fontSize: '16px' }}>⚙️</span>
              <span style={{ fontSize: '9px' }}>Admin</span>
            </button>
          )}
        </nav>
      ) : (
        <aside style={s.sidebar}>
          <div style={s.brand}>
            <span style={s.brandIcon}>⬡</span>
            <span style={s.brandName}>ClassShare</span>
          </div>
          <nav style={s.nav}>
            <p style={s.navLabel}>Categorie</p>
            {NAV_ITEMS.map(c => (
              <button
                key={c}
                style={category === c ? s.navItemActive : s.navItem}
                onClick={() => setCategory(c)}
              >
                {c === 'Tutti' ? 'Tutti i file' : c}
                {c === 'Progetti' && <span style={s.count}>{projects.length}</span>}
                {c !== 'Tutti' && c !== 'Progetti' && (
                  <span style={s.count}>
                    {files.filter(f => f.category === c && !f.projectId).length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          {isAdmin && (
            <button style={s.adminBtn} onClick={() => setShowAdmin(true)}>
              ⚙️ Admin
            </button>
          )}
          <button style={s.adminBtn} onClick={() => setShowPrivacy(true)}>
            🛡️ Privacy & GDPR
          </button>
          <div style={s.profileBar} onClick={() => setShowProfile(true)}>
            <div style={{ ...s.avatar, background: avatarColor(profile?.name || user?.email) }}>
              {initials(profile?.name || user?.email)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={s.profileName}>{profile?.name || 'Utente'}</p>
              <p style={s.profileSub}>{profile?.fileCount || 0} file caricati</p>
            </div>
            <button
              style={s.logoutBtn}
              onClick={e => { e.stopPropagation(); signOut(auth) }}
              title="Esci"
            >
              ↩
            </button>
          </div>
        </aside>
      )}

      <main style={{ ...s.main, paddingBottom: isMobile ? '80px' : '2rem' }}>
        <div style={s.topBar}>
          <div>
            <h1 style={{ ...s.heading, fontSize: isMobile ? '18px' : '22px' }}>
              {category === 'Tutti' ? 'Tutti i file' : category}
            </h1>
            <p style={s.subheading}>
              {category === 'Progetti'
                ? `${filteredProjects.length} progetti`
                : `${filteredProjects.length + filtered.length} elementi`}
            </p>
          </div>
          {!isMobile && (
            <button style={s.uploadBtn} onClick={() => setShowUpload(true)}>
              + Carica file
            </button>
          )}
        </div>

        <input
          style={s.search}
          placeholder="Cerca per nome, tag, autore..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* PROGETTI */}
        {filteredProjects.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            {category === 'Tutti' && <p style={s.sectionLabel}>Progetti</p>}
            <div style={s.grid}>
              {filteredProjects.map(project => {
                const pFiles = projectFiles(project.id)
                const isExpanded = expandedProject === project.id
                const isOwn = project.createdBy === user.uid
                return (
                  <div key={project.id} style={s.projectCard}>
                    <div
                      style={s.projectHeader}
                      onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '20px' }}>📁</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={s.projectName}>{project.name}</p>
                          {project.description && <p style={s.projectDesc}>{project.description}</p>}
                          <p style={s.fileMeta}>{pFiles.length} file · {project.creatorName}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {isOwn && (
                          <button
                            style={s.addToProjectBtn}
                            onClick={e => { e.stopPropagation(); setAddToProject(project.id) }}
                            title="Aggiungi file"
                          >
                            +
                          </button>
                        )}
                        {isOwn && (
                          <button
                            style={s.deleteBtn}
                            onClick={e => { e.stopPropagation(); handleDeleteProject(project) }}
                          >
                            ✕
                          </button>
                        )}
                        <span style={{ color: '#4a4a55', fontSize: '14px' }}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={s.projectFiles}>
                        {pFiles.length === 0 ? (
                          <p style={{ fontSize: '13px', color: '#6b6b75', padding: '8px 0' }}>
                            Nessun file nel progetto.
                          </p>
                        ) : (
                          pFiles.map(file => {
                            const ext = getExt(file.name)
                            const label = EXT_LABELS[ext] || ext.toUpperCase().slice(0, 4)
                            const isCode = CODE_EXTS.includes(ext)
                            const isImage = IMAGE_EXTS.includes(ext)
                            const isPdf = ext === 'pdf'
                            const hasPreview = isCode || isImage || isPdf
                            const isFileOwn = file.uploadedBy === user.uid
                            return (
                              <div key={file.id} style={s.projectFileRow}>
                                <div style={s.extBadgeSmall}>{label}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: '13px', color: '#e8e6e0', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {file.name}
                                  </p>
                                  <p style={{ fontSize: '11px', color: '#4a4a55' }}>
                                    {fmtSize(file.size)} · {fmtDate(file.createdAt)}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {hasPreview && (
                                    <button
                                      style={isImage ? s.previewImgBtn : isPdf ? s.previewPdfBtn : s.previewBtn}
                                      onClick={() => setPreviewFile(file)}
                                    >
                                      {isImage ? '🖼' : isPdf ? '📄' : '</>'}
                                    </button>
                                  )}
                                  <button style={s.actionBtn} onClick={() => forceDownload(file)}>↓</button>
                                  {isFileOwn && (
                                    <button style={s.deleteBtn} onClick={() => handleDelete(file)}>✕</button>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* FILE SINGOLI */}
        {category !== 'Progetti' && (
          <div>
            {category === 'Tutti' && filtered.length > 0 && <p style={s.sectionLabel}>File singoli</p>}
            {filtered.length === 0 && filteredProjects.length === 0 ? (
              <div style={s.empty}>
                <p style={s.emptyIcon}>◻</p>
                <p style={s.emptyText}>Nessun elemento trovato.</p>
                <p style={s.emptySub}>Prova a cambiare categoria o carica il primo file!</p>
              </div>
            ) : filtered.length === 0 ? null : (
              <div style={s.grid}>
                {filtered.map(file => {
                  const ext = getExt(file.name)
                  const label = EXT_LABELS[ext] || ext.toUpperCase().slice(0, 4)
                  const cat = CAT_COLORS[file.category] || CAT_COLORS['Altro']
                  const isOwn = file.uploadedBy === user.uid
                  const isCode = CODE_EXTS.includes(ext)
                  const isImage = IMAGE_EXTS.includes(ext)
                  const isPdf = ext === 'pdf'
                  const hasPreview = isCode || isImage || isPdf
                  return (
                    <div key={file.id} style={s.card}>
                      <div style={s.cardMid}>
                        <span
                          style={{
                            ...s.catBadge,
                            background: cat.bg,
                            color: cat.text,
                            border: `1px solid ${cat.border}`
                          }}
                        >
                          {file.category}
                        </span>
                        {(file.tags || []).map(t => (
                          <span
                            key={t}
                            style={s.tagBadgeClickable}
                            onClick={() => setSearch(t)}
                            title={`Filtra per "${t}"`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>

                      <div style={s.cardTop}>
                        <div style={s.extBadge}>{label}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={s.fileName}>{file.name}</p>
                          <p style={s.fileMeta}>{fmtSize(file.size)} · {fmtDate(file.createdAt)}</p>
                        </div>
                      </div>

                      <div style={s.cardBottom}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              ...s.miniAvatar,
                              background: avatarColor(file.uploaderName)
                            }}
                          >
                            {initials(file.uploaderName)}
                          </div>
                          <span style={s.uploaderName}>{file.uploaderName}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {hasPreview && (
                            <button
                              style={isImage ? s.previewImgBtn : isPdf ? s.previewPdfBtn : s.previewBtn}
                              onClick={() => setPreviewFile(file)}
                              title={isImage ? 'Anteprima immagine' : isPdf ? 'Anteprima PDF' : 'Anteprima codice'}
                            >
                              {isImage ? '🖼' : isPdf ? '📄' : '</>'}
                            </button>
                          )}
                          <button style={s.actionBtn} onClick={() => forceDownload(file)} title="Scarica">
                            ↓
                          </button>
                          {isOwn && (
                            <button style={s.deleteBtn} onClick={() => handleDelete(file)} title="Elimina">
                              ✕
                            </button>
                          )}
                          {isOwn && (
                            <button style={s.editBtn} onClick={() => setEditFile(file)} title="Modifica tag e categoria">
                              ✎
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => {}} />}
      {addToProject && (
        <UploadModal
          defaultProjectId={addToProject}
          onClose={() => setAddToProject(null)}
          onSuccess={() => {}}
        />
      )}
      {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {showProfile && (
        <ProfileModal
          user={user}
          profile={profile}
          files={files}
          onClose={() => setShowProfile(false)}
        />
      )}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      {editFile && (
        <EditModal
          file={editFile}
          onClose={() => setEditFile(null)}
          onSave={updated => setFiles(fs => fs.map(f => f.id === updated.id ? updated : f))}
        />
      )}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  )
}

const s = {
  bottomNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#17171a',
    borderTop: '1px solid #1e1e23',
    display: 'flex',
    alignItems: 'stretch',
    zIndex: 50,
    height: '60px'
  },
  bottomNavItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    border: 'none',
    background: 'transparent',
    color: '#6b6b75',
    cursor: 'pointer',
    fontFamily: 'DM Sans,sans-serif',
    padding: '6px 2px'
  },
  bottomNavActive: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    border: 'none',
    background: 'rgba(124,109,250,0.1)',
    color: '#a99bfc',
    cursor: 'pointer',
    fontFamily: 'DM Sans,sans-serif',
    padding: '6px 2px',
    borderTop: '2px solid #7c6dfa'
  },
  page: { display: 'flex', minHeight: '100vh', background: '#0e0e10' },
  sidebar: {
    width: '220px',
    flexShrink: 0,
    background: '#17171a',
    borderRight: '1px solid #1e1e23',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem 1rem'
  },
  brand: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' },
  brandIcon: { fontSize: '20px', color: '#7c6dfa' },
  brandName: { fontSize: '16px', fontWeight: '600', color: '#e8e6e0', letterSpacing: '-0.3px' },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  navLabel: {
    fontSize: '11px',
    color: '#4a4a55',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    marginBottom: '8px',
    marginLeft: '10px'
  },
  navItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: '#6b6b75',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans,sans-serif',
    textAlign: 'left',
    width: '100%'
  },
  navItemActive: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(124,109,250,0.12)',
    color: '#a99bfc',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans,sans-serif',
    textAlign: 'left',
    width: '100%',
    fontWeight: '500'
  },
  count: { fontSize: '11px', background: '#2a2a2f', color: '#6b6b75', padding: '1px 7px', borderRadius: '20px' },
  adminBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #2a2a2f',
    background: 'transparent',
    color: '#6b6b75',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans,sans-serif',
    width: '100%',
    marginBottom: '8px'
  },
  profileBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderTop: '1px solid #1e1e23',
    paddingTop: '1rem',
    marginTop: 'auto',
    cursor: 'pointer',
    borderRadius: '8px',
    padding: '10px'
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '500',
    color: '#fff',
    flexShrink: 0
  },
  miniAvatar: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: '500',
    color: '#fff'
  },
  profileName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#e8e6e0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  profileSub: { fontSize: '11px', color: '#4a4a55' },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: '#4a4a55',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
    flexShrink: 0
  },
  main: { flex: 1, padding: '2rem', overflowY: 'auto' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  heading: { fontSize: '22px', fontWeight: '600', color: '#e8e6e0', letterSpacing: '-0.4px' },
  subheading: { fontSize: '13px', color: '#4a4a55', marginTop: '3px' },
  uploadBtn: {
    background: '#7c6dfa',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'DM Sans,sans-serif',
    whiteSpace: 'nowrap'
  },
  search: {
    width: '100%',
    background: '#17171a',
    border: '1px solid #2a2a2f',
    borderRadius: '10px',
    padding: '10px 16px',
    color: '#e8e6e0',
    fontSize: '14px',
    fontFamily: 'DM Sans,sans-serif',
    outline: 'none',
    marginBottom: '1.5rem'
  },
  empty: { textAlign: 'center', paddingTop: '4rem' },
  emptyIcon: { fontSize: '40px', marginBottom: '12px', color: '#2a2a2f' },
  emptyText: { fontSize: '16px', color: '#6b6b75', fontWeight: '500' },
  emptySub: { fontSize: '13px', color: '#4a4a55', marginTop: '6px' },
  sectionLabel: {
    fontSize: '11px',
    color: '#4a4a55',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    marginBottom: '12px',
    marginTop: '4px'
  },
  projectCard: {
    background: '#17171a',
    border: '1px solid rgba(124,109,250,0.2)',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  projectHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', cursor: 'pointer' },
  projectName: { fontSize: '14px', fontWeight: '600', color: '#e8e6e0' },
  projectDesc: {
    fontSize: '12px',
    color: '#6b6b75',
    marginTop: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  projectFiles: {
    borderTop: '1px solid #1e1e23',
    padding: '8px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  projectFileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '7px 8px',
    background: '#0e0e10',
    borderRadius: '8px'
  },
  extBadgeSmall: {
    background: '#1e1e23',
    color: '#6b6b75',
    borderRadius: '4px',
    padding: '3px 6px',
    fontSize: '10px',
    fontWeight: '500',
    fontFamily: 'DM Mono,monospace',
    flexShrink: 0
  },
  addToProjectBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    background: 'rgba(124,109,250,0.12)',
    color: '#a99bfc',
    fontSize: '18px',
    border: '1px solid rgba(124,109,250,0.2)',
    cursor: 'pointer',
    fontFamily: 'DM Sans,sans-serif',
    lineHeight: 1
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' },
  card: {
    background: '#17171a',
    border: '1px solid #1e1e23',
    borderRadius: '12px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  cardTop: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  extBadge: {
    background: '#1e1e23',
    color: '#6b6b75',
    borderRadius: '6px',
    padding: '6px 8px',
    fontSize: '11px',
    fontWeight: '500',
    fontFamily: 'DM Mono,monospace',
    flexShrink: 0,
    letterSpacing: '0.5px'
  },
  fileName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#e8e6e0',
    wordBreak: 'break-all',
    lineHeight: '1.4'
  },
  fileMeta: { fontSize: '11px', color: '#4a4a55', marginTop: '3px' },
  cardMid: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  catBadge: { fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '500' },
  tagBadgeClickable: {
    fontSize: '11px',
    padding: '3px 10px',
    borderRadius: '20px',
    background: '#1e1e23',
    color: '#9b9ba8',
    border: '1px solid #2a2a2f',
    cursor: 'pointer',
    transition: 'all 0.15s'
  },
  cardBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #1e1e23',
    paddingTop: '10px'
  },
  uploaderName: { fontSize: '12px', color: '#6b6b75' },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '6px',
    background: 'rgba(124,109,250,0.12)',
    color: '#a99bfc',
    fontSize: '16px',
    border: '1px solid rgba(124,109,250,0.2)',
    cursor: 'pointer',
    fontFamily: 'DM Sans,sans-serif'
  },
  previewBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '6px',
    background: 'rgba(56,189,248,0.1)',
    color: '#7dd3fc',
    fontSize: '10px',
    border: '1px solid rgba(56,189,248,0.2)',
    cursor: 'pointer',
    fontFamily: 'DM Mono,monospace',
    fontWeight: '500'
  },
  previewImgBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '6px',
    background: 'rgba(52,211,153,0.1)',
    color: '#6ee7b7',
    fontSize: '14px',
    border: '1px solid rgba(52,211,153,0.2)',
    cursor: 'pointer'
  },
  previewPdfBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '6px',
    background: 'rgba(56,189,248,0.1)',
    color: '#7dd3fc',
    fontSize: '14px',
    border: '1px solid rgba(56,189,248,0.2)',
    cursor: 'pointer'
  },
  editBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '6px',
    background: 'rgba(251,146,60,0.1)',
    color: '#fb923c',
    border: '1px solid rgba(251,146,60,0.2)',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'DM Sans,sans-serif'
  },
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '6px',
    background: 'rgba(248,113,113,0.1)',
    color: '#f87171',
    border: '1px solid rgba(248,113,113,0.2)',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'DM Sans,sans-serif'
  }
}
