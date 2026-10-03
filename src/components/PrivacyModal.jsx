/**
 * Privacy Policy and GDPR Transparency Modal.
 * Explains data minimization, infrastructure, lack of third-party tracking,
 * and user rights under EU GDPR.
 * @param {{ onClose: () => void }} props
 */
export default function PrivacyModal({ onClose }) {
  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <p style={s.title}>Informativa sulla Privacy & GDPR</p>
            <p style={s.sub}>Trasparenza sul trattamento dei dati personali (Regolamento UE 2016/679)</p>
          </div>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>
          <section style={s.section}>
            <h3 style={s.sectionTitle}>1. 🎯 Finalità del Trattamento</h3>
            <p style={s.text}>
              <strong>ClassShare</strong> è una piattaforma web concepita per agevolare la condivisione collaborativa di file, documenti e snippet di codice all'interno di classi di studenti e corsi didattici. I dati raccolti sono trattati unicamente per consentire l'erogazione di questo servizio.
            </p>
          </section>

          <section style={s.section}>
            <h3 style={s.sectionTitle}>2. 🧩 Minimizzazione dei Dati (Art. 5 GDPR)</h3>
            <p style={s.text}>
              Raccogliamo e conserviamo esclusivamente le informazioni strettamente necessarie:
            </p>
            <ul style={s.list}>
              <li><strong>Nome visualizzato:</strong> per identificare l'autore del caricamento all'interno della classe.</li>
              <li><strong>Indirizzo email:</strong> utilizzato come identificativo unico per l'accesso e per il reset password.</li>
              <li><strong>File e codice:</strong> caricati di propria iniziativa dall'utente per la condivisione con i compagni.</li>
            </ul>
            <p style={s.textMuted}>
              Non richiediamo recapiti telefonici, dati anagrafici completi, geolocalizzazione o informazioni di pagamento.
            </p>
          </section>

          <section style={s.section}>
            <h3 style={s.sectionTitle}>3. ☁️ Infrastruttura e Fornitori Cloud</h3>
            <p style={s.text}>
              I dati sono custoditi su infrastrutture cloud conformi ai più rigorosi standard di sicurezza internazionali (SOC 2, ISO 27001, crittografia in transito HTTPS/TLS e a riposo):
            </p>
            <ul style={s.list}>
              <li><strong>Autenticazione e Database NoSQL:</strong> Firebase (Google Cloud Platform).</li>
              <li><strong>Object Storage dei file:</strong> Supabase (PostgreSQL / AWS Datacenter UE).</li>
            </ul>
          </section>

          <section style={s.section}>
            <h3 style={s.sectionTitle}>4. 🍪 Cookie e Tracciamento (Direttiva ePrivacy)</h3>
            <p style={s.text}>
              ClassShare adotta una politica rigorosa di <strong>Zero Tracking</strong>:
            </p>
            <ul style={s.list}>
              <li><strong>Nessun cookie pubblicitario o di profilazione.</strong></li>
              <li><strong>Nessun tracciamento di terze parti</strong> (es. Google Analytics, Meta Pixel).</li>
              <li>Vengono impiegati esclusivamente <em>token tecnici di sessione</em> (in LocalStorage/IndexedDB) strettamente indispensabili a mantenere autenticato l'utente. Per tale ragione, in base alle linee guida europee, non è richiesto alcun banner di consenso preventivo.</li>
            </ul>
          </section>

          <section style={s.section}>
            <h3 style={s.sectionTitle}>5. ⚖️ I Tuoi Diritti (Diritto all'Oblio - Art. 17 GDPR)</h3>
            <p style={s.text}>
              Hai il controllo totale sui tuoi dati in qualsiasi momento:
            </p>
            <ul style={s.list}>
              <li><strong>Accesso e Portabilità:</strong> puoi visualizzare e scaricare liberamente tutti i tuoi file dalla Dashboard.</li>
              <li><strong>Rettifica:</strong> puoi modificare categorie, tag e credenziali di accesso.</li>
              <li><strong>Cancellazione Totale:</strong> puoi eliminare singoli file o fare click su <em>"Elimina account"</em> nel tuo profilo per rimuovere definitivamente e irrevocabilmente il tuo account, il tuo profilo e tutti i file caricati sia dal database che dal cloud storage.</li>
            </ul>
          </section>
        </div>

        <div style={s.footer}>
          <button style={s.btnPrimary} onClick={onClose}>Ho capito</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '1rem'
  },
  modal: {
    background: '#17171a',
    border: '1px solid #2a2a2f',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '580px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #1e1e23'
  },
  title: { fontSize: '16px', fontWeight: '600', color: '#e8e6e0' },
  sub: { fontSize: '12px', color: '#6b6b75', marginTop: '3px' },
  close: {
    background: 'none',
    border: 'none',
    color: '#6b6b75',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
    borderRadius: '6px'
  },
  body: {
    padding: '1.25rem 1.5rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#a99bfc'
  },
  text: {
    fontSize: '13px',
    color: '#9b9ba8',
    lineHeight: '1.5'
  },
  textMuted: {
    fontSize: '12px',
    color: '#6b6b75',
    fontStyle: 'italic',
    marginTop: '2px'
  },
  list: {
    fontSize: '12px',
    color: '#9b9ba8',
    paddingLeft: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    lineHeight: '1.4'
  },
  footer: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #1e1e23',
    display: 'flex',
    justifyContent: 'flex-end'
  },
  btnPrimary: {
    padding: '8px 18px',
    border: 'none',
    borderRadius: '8px',
    background: '#7c6dfa',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif'
  }
}
