import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

const EDIT_CATEGORIES = ['Codice', 'Documenti', 'Immagini', 'Altro']

/**
 * Modal to edit tags and category for an uploaded file.
 * @param {{ file: object, onClose: () => void, onSave: (updated: object) => void }} props
 */
export default function EditModal({ file, onClose, onSave }) {
  const [category, setCategory] = useState(file.category || 'Codice')
  const [tags, setTags] = useState((file.tags || []).join(', '))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
      await updateDoc(doc(db, 'files', file.id), { category, tags: tagList })
      onSave({ ...file, category, tags: tagList })
      onClose()
    } catch (err) {
      console.error('Failed to update file:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.baseModal}>
        <div style={s.header}>
          <div>
            <p style={s.title}>Modifica file</p>
            <p style={s.meta}>{file.name}</p>
          </div>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={s.label}>Categoria</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {EDIT_CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '13px',
                    border: category === c ? '1px solid #7c6dfa' : '1px solid #2a2a2f',
                    background: category === c ? 'rgba(124,109,250,0.2)' : 'transparent',
                    color: category === c ? '#a99bfc' : '#6b6b75',
                    fontWeight: category === c ? '500' : '400'
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={s.label}>
              Tag <span style={{ color: '#4a4a55', fontWeight: '400' }}>(separati da virgola)</span>
            </label>
            <input
              style={s.inputDark}
              placeholder="es. react, homework, settimana3"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button style={s.btnOutline} onClick={onClose}>Annulla</button>
            <button
              style={saving ? s.btnDisabled : s.btn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
          </div>
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
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #1e1e23',
    paddingBottom: '1rem'
  },
  title: { fontSize: '15px', fontWeight: '600', color: '#e8e6e0' },
  meta: { fontSize: '12px', color: '#6b6b75', marginTop: '3px' },
  label: { fontSize: '13px', color: '#9b9ba8', fontWeight: '500' },
  close: {
    background: 'none',
    border: 'none',
    color: '#6b6b75',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
    borderRadius: '6px'
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
  btn: {
    padding: '10px 18px',
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
    padding: '10px 18px',
    border: 'none',
    borderRadius: '8px',
    background: '#3d3860',
    color: '#9b9ba8',
    fontSize: '13px',
    cursor: 'not-allowed',
    fontFamily: 'DM Sans, sans-serif'
  }
}
