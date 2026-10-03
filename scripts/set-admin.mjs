import admin from 'firebase-admin'
import fs from 'fs'

// Esempio di utilizzo:
// node scripts/set-admin.mjs admin@example.com ./service-account.json

const args = process.argv.slice(2)
const email = args[0]
const serviceAccountPath = args[1]

if (!email || !serviceAccountPath) {
  console.error("Uso corretto: node scripts/set-admin.mjs <email_utente> <percorso_file_json_servizio>")
  process.exit(1)
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Errore: File non trovato a ${serviceAccountPath}`)
  process.exit(1)
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

async function setAdminClaim() {
  try {
    const user = await admin.auth().getUserByEmail(email)
    await admin.auth().setCustomUserClaims(user.uid, { admin: true })
    console.log(`Successo! Custom Claim { admin: true } impostato per l'utente ${email} (UID: ${user.uid}).`)
    console.log(`Chiedi all'utente di fare logout e login di nuovo per aggiornare il token.`)
    process.exit(0)
  } catch (error) {
    console.error("Errore durante l'impostazione del Custom Claim:", error)
    process.exit(1)
  }
}

setAdminClaim()
