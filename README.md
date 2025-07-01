# PYFUEL 🚀⛽

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)  
[![Contributors](https://img.shields.io/github/contributors/your-username/pyfuel)](https://github.com/your-username/pyfuel/graphs/contributors)

**Pyfuel** è un sistema di gestione completo per impianti di erogazione carburante “private” (flotte aziendali, depositi, ecc.) basato su Raspberry Pi e hardware open.

---

## 📋 Sommario

- [Caratteristiche](#-caratteristiche)  
- [Architettura & Tecnologie](#-architettura--tecnologie)  
- [Installer & Avvio](#-installer--avvio)  
- [Dashboard Web](#-dashboard-web)  
  - [Sezione Erogazioni](#sezione-erogazioni)  
  - [Sezione Autisti](#sezione-autisti)  
  - [Sezione Veicoli](#sezione-veicoli)  
  - [Sezione Parametri](#sezione-parametri)  
- [Screenshots](#-screenshots)  
- [Contribuire](#-contribuire)  
- [Licenza](#-licenza)  

---

## 🔥 Caratteristiche

- **Dispersione simultanea**: supporto per doppia erogazione in parallelo  
- **Modalità Self-Service**: card RFID + PIN + verifica veicolo/km  
- **Modalità Manuale**: rapido, senza controlli  
- **Timer di interazione**: selezione lato, approvazione card, erogazione  
- **Dashboard Web** per visualizzare, filtrare ed esportare i dati  
- **CRUD** completo su Autisti e Veicoli  
- **Esportazione CSV** (pagina singola o totale)  
- **Configurazione parametrica** (pre­set litri, GPIO, colori, testi…)  
- **Archiviazione sicura** con PostgreSQL  

---

## 🏗 Architettura & Tecnologie

| Componente         | Tecnologia                |
|--------------------|---------------------------|
| **GUI Touch**      | Python + CustomTkinter    |
| **Backend HW**     | Python (asyncio + GPIO)   |
| **API & Web**      | FastAPI + SQLAlchemy      |
| **Asincronia**     | `asyncio` per parallelismi|
| **DB**             | PostgreSQL                |
| **Dashboard Web**  | Javascript + REST API     |

1. **Raspberry Pi** → gestione GPIO (pompe, valvole, pulser).  
2. **GUI CTK** → interfaccia locale CustomTKinter personalizzata.  
3. **FastAPI** → server asincrono REST per web & servizi interni.  
4. **SQLAlchemy** → mappatura ORM su database locale.  

---

## 🖥 Installer & Avvio

1. Dalla root del repo:
   ```bash
   chmod +x installer.sh
   sudo ./installer.sh

    Abilita login automatico su tty1.

    Riavvia il sistema:

    sudo reboot

Al boot, Pyfuel parte in Self (verde). Per cambiare modalità di avvio, usa la dashboard:

    Parametri → Parametri Fuel → Modalità automatica (ON/OFF)

🌐 Dashboard Web

La Dashboard si compone di quattro sezioni principali:
Sezione Erogazioni

![Screenshot From 2025-06-30 18-37-22](https://github.com/user-attachments/assets/c3447974-f5f5-4586-993d-c4859aeef2d7)


    Visualizza tutte le erogazioni (automatiche e manuali)

    Filtri per campo:

![Screenshot From 2025-06-30 18-37-38](https://github.com/user-attachments/assets/2e22cf78-3163-49ef-bea6-fbd2f269cdd6)


        totale litri, utente (tessera/nome), modalità, prodotto, dati veicolo (se presenti), lato di erogazione (1 o 2)

    Filtri temporali: da–a + combinazione con filtri di campo

![Screenshot From 2025-06-30 18-40-20](https://github.com/user-attachments/assets/86f0c1fc-99c8-424f-95df-6df4b1312edf)


    Esportazione CSV: pagina corrente o tutti i record

    Paginazione: 10/25/50 elementi per pagina

    Reset Dati: elimina tutta la cronologia erogazioni (no singoli)

Sezione Autisti

![Screenshot From 2025-06-30 18-40-46](https://github.com/user-attachments/assets/73921df1-d8bc-4a38-9ac8-49ce68d12f93)


    Associa tessera → dati: nome, cognome, azienda

    PIN (on/off)

    Richiesta numero veicolo (on/off)

    Gestione CRUD: Aggiungi / Modifica / Elimina

    Esportazione CSV + paginazione

Sezione Veicoli

![Screenshot From 2025-06-30 18-40-52](https://github.com/user-attachments/assets/7139036e-e18a-4ead-b63e-da84d44468af)


    Dati univoci: ID veicolo, azienda, km totali, targa

    Richiesta inserimento km (on/off)

    Associazione autista–veicolo per flessibilità esterni

    Gestione CRUD: Aggiungi / Modifica / Elimina

    Esportazione CSV + paginazione

    Ogni erogazione riporta dati autista + veicolo per tracciabilità completa.

Sezione Parametri

    Parametri Fuel (per lato)

![Screenshot From 2025-06-30 18-38-41](https://github.com/user-attachments/assets/dee53b1a-7a39-43bd-a878-20b67b19088c)


        GPIO pump, pulser, litri/pulse

        Timer di erogazione, prezzo al litro ecc.

    Parametri GUI (per lato)

![Screenshot From 2025-06-30 18-39-19](https://github.com/user-attachments/assets/21160e9f-77a4-4308-8edd-b1a798bff20e)


        Colori, bordi, testi dei pulsanti e messaggi

    Parametri Principali

![Screenshot From 2025-06-30 18-39-43](https://github.com/user-attachments/assets/0f7821a8-b9c1-4f14-8287-ba8969dd4ff1)


        Testi di avviso, timeout generali,

    Gestione Lati

        Abilita/disabilita lato 1 e lato 2

        (Massimo 2 lati – indispensabili per erogare)

Tutte le modifiche ai parametri vegono applicate al riavvio del sistema.
📸 Screenshots

[Self mode]: ![Screenshot From 2025-06-30 18-34-36](https://github.com/user-attachments/assets/c66c98f0-f161-4c02-bced-5003cddf0fd2)

[Pin request]: ![Screenshot From 2025-06-30 18-34-57](https://github.com/user-attachments/assets/771e61f4-fa38-48f2-aee6-12a1b21d194e)

[Side selection]: ![Screenshot From 2025-06-30 18-35-44](https://github.com/user-attachments/assets/e672a8ab-0c69-4a58-a915-8c4c77087779)

[Side busy]: ![Screenshot From 2025-06-30 18-36-18](https://github.com/user-attachments/assets/247f1ccf-ac2a-4dd8-9a0f-bd7fd9e12f72)


🤝 Contribuire

    Fork del progetto

    Crea un branch feature:

    git checkout -b feat/my-feature

    Commit & push delle modifiche

    Apri una Pull Request

    Rispetta il Codice di Condotta

📄 Licenza

Distribuito sotto licenza MIT. Vedi LICENSE per i dettagli.

    Pyfuel: performance, sicurezza e semplicità per il tuo impianto carburante!
