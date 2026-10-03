# 1. Prendiamo l'ambiente Node.js ufficiale (versione 20, basata su Alpine Linux che è leggerissima)
FROM node:20-alpine

# 2. Creiamo e impostiamo la cartella di lavoro principale dentro il container Linux
WORKDIR /app

# 3. Copiamo il package.json e il package-lock.json per far capire a Docker quali pacchetti servono
COPY package*.json ./

# 4. Installiamo i pacchetti. Usiamo i flag di sicurezza per velocizzare ed evitare blocchi su Windows
RUN npm install --legacy-peer-deps --no-audit --no-fund

# 5. Copiamo tutto il resto del codice sorgente del tuo progetto dentro il container
COPY . .

# 6. Diciamo a Docker che questa applicazione ascolterà sulla porta 5173 (quella standard di Vite)
EXPOSE 5173

# 7. Il comando per avviare il server di sviluppo di Vite in modalità pubblica (--host)
CMD ["npm", "run", "dev", "--", "--host"]