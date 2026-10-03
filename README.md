<div align="center">

# ⬡ ClassShare

**Collaborative cloud file-sharing and code snippet platform built for student developer communities.**

[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Storage-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Live Demo](https://img.shields.io/badge/Live_Demo-classshare--kqru.vercel.app-000000?style=flat&logo=vercel&logoColor=white)](https://classshare-kqru.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[🌐 Live Demo](https://classshare-kqru.vercel.app/) • [✨ Key Features](#-key-features) • [🏛 Architecture](#-architecture) • [🚀 Quick Start](#-quick-start) • [🛡 Security](#-security--access-control)

</div>

---

## 💡 About The Project

**ClassShare** was created to solve a real-world communication friction in developer training cohorts: sharing homework code snippets, assets, PDF documentation, and team deliverables quickly without relying on cluttered chat apps or paid cloud drives.

It adopts a **cost-efficient hybrid serverless architecture**, leveraging:
- **Firebase Authentication & Cloud Firestore** for zero-latency reactive data streams (`onSnapshot`) and granular user roles (Custom Claims).
- **Supabase Storage** for unmetered public file delivery, avoiding costly bandwidth quotas on Google Cloud Storage.

---

## 🌐 Live Demo

> **Live Demo:** [https://classshare-kqru.vercel.app](https://classshare-kqru.vercel.app)

Recruiters and portfolio visitors can test the live application instantly with **one click** via the built-in **"⚡ Prova rapida con Account Demo"** button on the login screen, without needing to register a personal email.

---

## ✨ Key Features

- **📁 Multi-File Upload & Drag-and-Drop:** Queue and upload multiple files simultaneously with individual upload progress indicators.
- **`</>` Instant Code Snippet Sharing:** Paste source code directly into the browser, pick language/extension (`.js`, `.py`, `.sql`, `.ts`, etc.), and generate downloadable source files on the fly.
- **👁 Inline Previews:**
  - **Code:** Syntax preview directly in a modal without downloading.
  - **Images:** High-resolution zoomable lightbox.
  - **PDF Documents:** Embedded interactive PDF viewer.
- **📂 Project Workspaces:** Group files into course modules or project assignments with folder management.
- **🏷 Dynamic Tagging & Instant Filtering:** Filter files by category (`Codice`, `Documenti`, `Immagini`, `Altro`), click tags to filter in real-time, or use universal search.
- **⚙️ Role-Based Admin Panel:** Built with Firebase Admin SDK (`customUserClaims`). Allows designated admins to inspect overall storage usage, reassign files between projects, reset user passwords, and perform cascading deletions across storage and database.
- **📱 Fully Responsive:** Dark mode user experience optimized for desktop and mobile, with bottom-sheet navigation on smaller viewports.

---

## 🏛 Architecture

```mermaid
flowchart TD
    subgraph Client ["Client (React 18 + Vite)"]
        UI["Dark Mode UI / Modals"]
        AuthContext["Auth Context (User + Role Claims)"]
    end

    subgraph Firebase ["Firebase Backend"]
        Auth["Firebase Auth (Email/Password + Custom Claims)"]
        Firestore["Cloud Firestore (Real-time Metadata Sync)"]
    end

    subgraph Supabase ["Supabase Cloud"]
        Storage["Supabase Object Storage (Public Bucket)"]
    end

    UI -->|"Authenticate / Token"| Auth
    UI -->|"Real-time Listeners (onSnapshot)"| Firestore
    UI -->|"Direct Multipart Upload / GetPublicUrl"| Storage
    AuthContext -->|"Admin Privileges Verification"| Firestore
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js `20.x` or higher
- npm or pnpm
- (Optional) Docker & Docker Compose

### 1. Clone the repository
```bash
git clone https://github.com/nicobada/classshare.git
cd classshare
```

### 2. Configure Environment Variables
Copy the template and fill in your Firebase and Supabase credentials:
```bash
cp .env.example .env.local
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key | `AIzaSy...` |
| `VITE_FIREBASE_PROJECT_ID`| Firebase Project ID | `your-project` |
| `VITE_FIREBASE_AUTH_DOMAIN`| Firebase Auth Domain | `your-project.firebaseapp.com` |
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://xyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Public Anon Key | `eyJhbG...` |
| `VITE_ALLOWED_DOMAIN` | Optional email domain restriction | `@university.edu` *(or empty for all)* |
| `VITE_DEMO_EMAIL` | One-click demo login email | `demo@classshare.app` |
| `VITE_DEMO_PASSWORD` | One-click demo password | `ClassShareDemo2025!` |

---

### 3. Run Locally

#### Option A: With Docker Compose
```bash
docker compose up --build
```
Open [http://localhost:3003](http://localhost:3003) in your browser.

#### Option B: With Node.js
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚙️ Administration & Custom Claims

To grant administrator access to a specific instructor or developer account, use the provided Node.js script:

```bash
node scripts/set-admin.mjs user@example.com ./service-account.json
```
*The user will immediately gain access to the Admin Dashboard upon their next login.*

---

## 🛡 Security & Access Control

- **Cloud Firestore Security Rules (Production):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /profiles/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid || request.auth.token.admin == true;
    }
    match /files/{fileId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && (
        request.auth.uid == resource.data.uploadedBy || request.auth.token.admin == true
      );
      allow update: if request.auth != null && (
        request.auth.uid == resource.data.uploadedBy || request.auth.token.admin == true
      );
    }
    match /projects/{projectId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete, update: if request.auth != null && (
        request.auth.uid == resource.data.createdBy || request.auth.token.admin == true
      );
    }
  }
}
```

---

## 🇪🇺 Privacy & GDPR Compliance (Privacy by Design)

ClassShare is engineered in strict accordance with the **EU General Data Protection Regulation (GDPR - Regulation EU 2016/679)** and the **ePrivacy Directive**:

- **🧩 Data Minimization (Art. 5 GDPR):** Only strictly essential identifiers are stored: display name, email, and files explicitly shared by the user. No telemetry, third-party marketing, or personal profiling.
- **🍪 Zero Third-Party Trackers:** No analytics beacons, tracking pixels, or marketing cookies. Only secure first-party authentication session tokens are utilized, eliminating intrusive cookie banner requirements under European law.
- **🗑️ Right to Erasure / "Right to be Forgotten" (Art. 17 GDPR):** Users have full self-service control. Directly from their profile, users can permanently delete their authentication account, Firestore profile metadata, and all uploaded files from cloud object storage in a cascading purge.
- **🔒 Data Security & Infrastructure (Art. 32 GDPR):** Transport security via TLS/HTTPS, encrypted storage at rest (Google Cloud & Supabase EU data centers), and Granular Security Rules enforcing ownership verification on all read/write/delete operations.
- **📜 Transparent Privacy Notice:** Built-in modal disclosure accessible from both the authentication screen and the main dashboard.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

