export const CATEGORIES = ['Tutti', 'Codice', 'Documenti', 'Immagini', 'Altro']
export const NAV_ITEMS = ['Tutti', 'Progetti', 'Codice', 'Documenti', 'Immagini', 'Altro']

export const CODE_EXTS = [
  'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'php', 'py', 'java', 'c', 'cpp',
  'json', 'md', 'txt', 'xml', 'yaml', 'yml', 'sh', 'sql', 'vue', 'svelte', 'rs', 'go'
]

export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']

export const CAT_COLORS = {
  Codice:    { bg: 'rgba(124,109,250,0.12)', text: '#a99bfc', border: 'rgba(124,109,250,0.25)' },
  Documenti: { bg: 'rgba(56,189,248,0.12)',  text: '#7dd3fc', border: 'rgba(56,189,248,0.25)' },
  Immagini:  { bg: 'rgba(52,211,153,0.12)',  text: '#6ee7b7', border: 'rgba(52,211,153,0.25)' },
  Altro:     { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', border: 'rgba(148,163,184,0.25)' }
}

export const EXT_LABELS = {
  pdf: 'PDF', zip: 'ZIP', js: 'JS', jsx: 'JSX', ts: 'TS', tsx: 'TSX',
  html: 'HTM', css: 'CSS', png: 'PNG', jpg: 'JPG', jpeg: 'JPG', gif: 'GIF',
  svg: 'SVG', mp4: 'MP4', mp3: 'MP3', docx: 'DOC', xlsx: 'XLS', pptx: 'PPT',
  txt: 'TXT', json: 'JSON', md: 'MD', php: 'PHP', py: 'PY', java: 'JAVA',
  sql: 'SQL', vue: 'VUE', sh: 'SH'
}

const AVATAR_COLORS = ['#7c6dfa', '#38bdf8', '#34d399', '#fb923c', '#f472b6', '#a3e635']

/**
 * Extracts file extension in lowercase.
 * @param {string} filename
 * @returns {string}
 */
export function getExt(filename) {
  if (!filename || typeof filename !== 'string') return ''
  return filename.split('.').pop().toLowerCase()
}

/**
 * Formats byte size into human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function fmtSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

/**
 * Formats a Firebase Timestamp into a relative or Italian date.
 * @param {import('firebase/firestore').Timestamp} ts
 * @returns {string}
 */
export function fmtDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'Adesso'
  if (diff < 3600) return Math.floor(diff / 60) + 'm fa'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h fa'
  if (diff < 604800) return Math.floor(diff / 86400) + 'g fa'
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

/**
 * Extracts first letters of names for avatar.
 * @param {string} name
 * @returns {string}
 */
export function initials(name) {
  return (name || '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('')
}

/**
 * Generates deterministic avatar background color from string.
 * @param {string} str
 * @returns {string}
 */
export function avatarColor(str) {
  let hash = 0
  for (let c of (str || '')) {
    hash = c.charCodeAt(0) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/**
 * Triggers a direct download of a remote file.
 * @param {{url: string, name: string}} file
 * @returns {Promise<void>}
 */
export async function forceDownload(file) {
  try {
    const res = await fetch(file.url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch (err) {
    console.error('Download error:', err)
    window.open(file.url, '_blank')
  }
}
