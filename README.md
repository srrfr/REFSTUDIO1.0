# REFSTUDIO - Gestionale Professionale per Arbitri di Calcio ⚽

Piattaforma web avanzata per direttori di gara, assistenti e osservatori arbitrali, progettata per raccogliere, analizzare e consultare informazioni su campionati, squadre, calciatori, note disciplinari e video.

---

## 🌟 Caratteristiche Principali

- **Data Provider Abstraction Layer**: Livello astratto per l'acquisizione dati. Include un `ExcelDataProvider` collegato direttamente ai file del Campionato di Eccellenza Emilia-Romagna (Girone A & Girone B, Gare e Classifiche).
- **Console Amministratore protetta da PIN (`280899`)**: Modifica in tempo reale di squadre, campi di gioco, valutazioni tecniche (1-5), aggressività (1-5), atteggiamento panchina e tag arbitro.
- **Dossier & Briefing Pre-Gara Gemini AI**: Assistente tattico che incrocia classifiche, diffide, ammonizioni e profili disciplinari per preparare la terna prima del fischio d'inizio.
- **Archivio Note Strutturate**: Annotazioni riservate per squadre, calciatori, allenatori, dirigenti e partite con supporto ad allegati.
- **Videoteca & Clip Didattiche**: Collegamento ed embed di video YouTube o clip video locali associate a calciatori, squadre ed episodi specifici con timestamp.
- **Dark Mode Nativa & Referee UI**: Design responsive orientato all'utilizzo in mobilità e nello spogliatoio.

---

## 📁 Struttura Dati Excel di Default

I file Excel sorgente configurati sono:
1. `Eccellenza_Emilia_Romagna_Girone_A.xlsx` (17 squadre con fogli dedicati e rose complete)
2. `Eccellenza_Emilia_Romagna_Girone_B.xlsx` (18 squadre con fogli dedicati e rose complete)
3. `Eccellenza_Emilia_Romagna_Gare_Classifica.xlsx` (Calendario 603 gare e classifiche aggiornate per Girone A e B)

---

## 🚀 Avvio Rapido

### 1. Installazione dipendenze
```bash
npm install
```

### 2. Sincronizzazione Dataset Excel tramite Data Provider
```bash
npm run sync-excel
```

### 3. Avvio Server di Sviluppo
```bash
npm run dev
```
L'applicazione sarà disponibile su [http://localhost:3000](http://localhost:3000).

---

## 🔐 Accesso Amministratore
- Clicca su **"Sblocca Admin (PIN)"** nella barra laterale o nell'header.
- Inserisci il codice segreto: `280899`.
- Verranno abilitati i controlli di modifica diretta in-app, form di anagrafica e sincronizzazione del Data Provider.
