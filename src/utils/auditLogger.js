import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Action types recorded in the GDPR and security audit trail.
 * @typedef {'FILE_UPLOAD' | 'CODE_SHARE' | 'FILE_DELETE' | 'PROJECT_CREATE' | 'PROJECT_DELETE' | 'GDPR_FORGOTTEN' | 'ADMIN_RESET_PWD' | 'ADMIN_REASSIGN' | 'ADMIN_DELETE_USER' | 'ADMIN_PURGE'} AuditAction
 */

/**
 * Records an immutable event in the 'audit_logs' Firestore collection.
 * Non-blocking: errors are caught and logged without disrupting the user flow.
 *
 * @param {{
 *   action: AuditAction,
 *   actorName?: string,
 *   actorEmail?: string,
 *   details: string
 * }} event
 * @returns {Promise<void>}
 */
export async function logAuditEvent({ action, actorName, actorEmail, details }) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      action,
      actorName: actorName || 'Anonimo',
      actorEmail: actorEmail || '',
      details: details || '',
      createdAt: serverTimestamp()
    })
  } catch (err) {
    // Non-blocking fallback
    console.warn('Audit logger warning:', err.message)
  }
}

/**
 * Returns human-readable badges and colors for each audit action.
 * @param {string} action
 * @returns {{ label: string, bg: string, color: string, border: string }}
 */
export function getActionBadge(action) {
  switch (action) {
    case 'FILE_UPLOAD':
    case 'CODE_SHARE':
      return { label: 'UPLOAD', bg: 'rgba(52, 211, 153, 0.12)', color: '#34d399', border: 'rgba(52, 211, 153, 0.25)' }
    case 'FILE_DELETE':
    case 'PROJECT_DELETE':
    case 'ADMIN_PURGE':
      return { label: 'DELETE', bg: 'rgba(248, 113, 113, 0.12)', color: '#f87171', border: 'rgba(248, 113, 113, 0.25)' }
    case 'GDPR_FORGOTTEN':
      return { label: 'GDPR OBLIO', bg: 'rgba(244, 114, 182, 0.12)', color: '#f472b6', border: 'rgba(244, 114, 182, 0.25)' }
    case 'PROJECT_CREATE':
      return { label: 'PROGETTO', bg: 'rgba(56, 189, 248, 0.12)', color: '#7dd3fc', border: 'rgba(56, 189, 248, 0.25)' }
    case 'ADMIN_RESET_PWD':
    case 'ADMIN_REASSIGN':
    case 'ADMIN_DELETE_USER':
      return { label: 'ADMIN', bg: 'rgba(251, 146, 60, 0.12)', color: '#fb923c', border: 'rgba(251, 146, 60, 0.25)' }
    default:
      return { label: 'EVENTO', bg: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)' }
  }
}
