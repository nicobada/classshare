/**
 * Diagnostic script for Supabase Storage and Firebase Firestore.
 * Run with: node scripts/check_storage.mjs
 *
 * Checks:
 * 1. Supabase bucket existence and public access
 * 2. Upload permission with a tiny test blob
 * 3. Firebase Firestore: files and profiles collections count
 */

import { createClient } from '@supabase/supabase-js'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore'

// ── Load env vars from .env.local manually (no dotenv dependency needed) ──
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')

const env = {}
try {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    env[key] = val
  }
  console.log('✅ .env.local loaded successfully\n')
} catch (err) {
  console.error('❌ Could not read .env.local:', err.message)
  process.exit(1)
}

const SUPABASE_URL     = env.VITE_SUPABASE_URL
const SUPABASE_ANON    = env.VITE_SUPABASE_ANON_KEY
const STORAGE_BUCKET   = 'files'

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID,
}

// ── 1. SUPABASE ──────────────────────────────────────────────────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📦  SUPABASE STORAGE DIAGNOSTICS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('URL:', SUPABASE_URL)
console.log('Bucket:', STORAGE_BUCKET)

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// List buckets
const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets()
if (bucketsErr) {
  console.error('❌ Cannot list buckets:', bucketsErr.message)
} else {
  console.log('\nBuckets found:', buckets.map(b => `${b.name} (public=${b.public})`).join(', ') || '(none)')
  const target = buckets.find(b => b.name === STORAGE_BUCKET)
  if (!target) {
    console.error(`❌ Bucket "${STORAGE_BUCKET}" NOT FOUND — this is why uploads fail!`)
  } else {
    console.log(`✅ Bucket "${STORAGE_BUCKET}" exists, public=${target.public}`)
  }
}

// List files in bucket (first 10)
const { data: fileList, error: listErr } = await supabase.storage
  .from(STORAGE_BUCKET).list('', { limit: 10 })
if (listErr) {
  console.error(`\n❌ Cannot list files in bucket "${STORAGE_BUCKET}":`, listErr.message)
  console.log('   → Likely cause: RLS policy blocking reads, or bucket does not exist.')
} else {
  console.log(`\n✅ Can list files in bucket. Total shown (max 10): ${fileList.length}`)
  if (fileList.length > 0) {
    console.log('   First file:', fileList[0].name, '—', Math.round((fileList[0].metadata?.size || 0) / 1024) + ' KB')
  }
}

// Test upload with a tiny blob
const testKey = `__diagnostic_test_${Date.now()}.txt`
const testBlob = new Blob(['classshare-diagnostic-ok'], { type: 'text/plain' })

console.log('\n🔄 Testing upload permission...')
const { error: upErr } = await supabase.storage
  .from(STORAGE_BUCKET).upload(testKey, testBlob, { upsert: false })
if (upErr) {
  console.error('❌ Upload failed:', upErr.message)
  if (upErr.message.includes('Unauthorized') || upErr.message.includes('policy')) {
    console.log('   → ROOT CAUSE: The bucket RLS/policy is blocking anonymous uploads.')
    console.log('   → FIX: In Supabase → Storage → Policies → add INSERT policy for authenticated users.')
  } else if (upErr.message.includes('not found') || upErr.message.includes('does not exist')) {
    console.log('   → ROOT CAUSE: Bucket does not exist.')
  }
} else {
  console.log('✅ Upload works!')
  // Clean up test file
  await supabase.storage.from(STORAGE_BUCKET).remove([testKey])
  console.log('   (test file removed)')
}

// ── 2. FIREBASE FIRESTORE ────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🔥  FIREBASE FIRESTORE DIAGNOSTICS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Project ID:', firebaseConfig.projectId)

try {
  const app = initializeApp(firebaseConfig)
  const db  = getFirestore(app)

  for (const col of ['files', 'projects', 'profiles']) {
    try {
      const snap = await getDocs(query(collection(db, col), limit(5)))
      console.log(`✅ Collection "${col}": ${snap.size} docs (showing max 5)`)
      if (col === 'files' && snap.size > 0) {
        const sample = snap.docs[0].data()
        console.log(`   Sample file: name="${sample.name}", uploadedBy="${sample.uploadedBy}", url="${(sample.url || '').slice(0, 60)}..."`)
      }
    } catch (colErr) {
      console.error(`❌ Cannot read "${col}":`, colErr.message)
    }
  }
} catch (fbErr) {
  console.error('❌ Firebase init error:', fbErr.message)
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Diagnostics complete.')
