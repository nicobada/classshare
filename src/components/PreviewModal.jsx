import { useState, useEffect } from 'react'
import { getExt, fmtSize, forceDownload, CODE_EXTS, IMAGE_EXTS } from '../utils/fileHelpers'

/**
 * Modal to preview images, PDF documents, or code snippets inline.
 * @param {{ file: object, onClose: () => void }} props
 */
export default function PreviewModal({ file, onClose }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const ext = getExt(file.name)
  const isImage = IMAGE_EXTS.includes(ext)
  const isPdf = ext === 'pdf'
  const isCode = CODE_EXTS.includes(ext)

  useEffect(() => {
    if (isCode) {
      fetch(file.url)
        .then(r => r.text())
        .then(t => {
          setCode(t)
          setLoading(false)
        })
        .catch(() => {
          setCode('Impossibile caricare il file.')
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [file.url, isCode])

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...s.previewModal, maxWidth: isImage ? '600px' : '800px' }}>
        <div style={s.previewHeader}>
          <div>
            <p style={s.previewTitle}>{file.name}</p>
            <p style={s.previewMeta}>{fmtSize(file.size)} · caricato da {file.uploaderName}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button style={s.btnDownload} onClick={() => forceDownload(file)}>
              ↓ Scarica
            </button>
            <button style={s.close} onClick={onClose}>✕</button>
          </div>
        </div>
        <div
          style={{
            ...s.previewBody,
            display: 'flex',
            alignItems: isImage ? 'center' : 'flex-start',
            justifyContent: isImage ? 'center' : 'flex-start'
          }}
        >
          {loading ? (
            <p style={{ color: '#6b6b75', fontSize: '14px' }}>Caricamento...</p>
          ) : isImage ? (
            <img
              src={file.url}
              alt={file.name}
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                borderRadius: '8px',
                objectFit: 'contain'
              }}
            />
          ) : isPdf ? (
            <iframe
              src={file.url}
              style={{ width: '100%', height: '65vh', border: 'none', borderRadius: '8px' }}
              title={file.name}
            />
          ) : isCode ? (
            <pre style={s.pre}><code>{code}</code></pre>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ fontSize: '48px', marginBottom: '16px' }}>📄</p>
              <p style={{ color: '#9b9ba8', fontSize: '14px', marginBottom: '8px' }}>
                Anteprima non disponibile per questo tipo di file.
              </p>
              <button style={s.btnDownload} onClick={() => forceDownload(file)}>
                ↓ Scarica il file
              </button>
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
  previewModal: {
    background: '#17171a',
    border: '1px solid #2a2a2f',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #1e1e23'
  },
  previewTitle: { fontSize: '15px', fontWeight: '600', color: '#e8e6e0' },
  previewMeta: { fontSize: '12px', color: '#6b6b75', marginTop: '3px' },
  previewBody: { flex: 1, overflow: 'auto', padding: '1.25rem 1.5rem' },
  pre: {
    fontFamily: 'DM Mono, monospace',
    fontSize: '13px',
    color: '#e8e6e0',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0
  },
  btnDownload: {
    padding: '7px 16px',
    border: '1px solid rgba(124,109,250,0.3)',
    borderRadius: '8px',
    background: 'rgba(124,109,250,0.12)',
    color: '#a99bfc',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif'
  },
  close: {
    background: 'none',
    border: 'none',
    color: '#6b6b75',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
    borderRadius: '6px'
  }
}
