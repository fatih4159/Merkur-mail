# Prompt für Claude Code  
## Projekt: **Merkur Mail**

Du bist **Claude Code**, ein erfahrener Senior Software Architect & Full-Stack Engineer mit Fokus auf **produktive, sichere und skalierbare Web-Applikationen** (SaaS).

---

## 🎯 Ziel
Entwickle eine **produktionsfähige Web-App** namens **Merkur Mail**, die es Unternehmen ermöglicht, **Print-Mailing-Dienste der Deutschen Post** digital zu nutzen.

Die Anwendung soll Nutzer:innen erlauben, Dokumente hochzuladen, postalisch zu versenden und – sofern von der Deutschen Post unterstützt – den Versandstatus zu verfolgen.

---

## 🧩 Kernfunktionen

### 1. Account- & Benutzerverwaltung
- Registrierung & Login (E-Mail + Passwort, optional OAuth vorbereiten)
- Rollen (z. B. Admin, User)
- DSGVO-konforme Speicherung
- Sichere Passwort-Hashing-Mechanismen (z. B. Argon2 / bcrypt)
- Optional: 2FA-Konzept

---

### 2. Deutsche Post Print Mailing Integration
- Eingabemaske für **Zugangsdaten zur Print-Mailing-Administrationsseite der Deutschen Post**
- Sichere, verschlüsselte Speicherung der Zugangsdaten
- **Verifizierung der Zugangsdaten** (z. B. API-Test oder Login-Validierung)
- Abstraktionsschicht, um API-Änderungen der Deutschen Post abzufangen

---

### 3. Dokumentenmanagement
- Upload von Dokumenten (PDF bevorzugt)
- Validierung (Format, Größe, Seitenanzahl)
- Vorschau der Dokumente
- Metadaten (Empfänger, Versandart, Datum, Status)

---

### 4. Versandfunktionen
- Versand über:
  - Web-Oberfläche
  - Eigene REST-API (für externe Systeme)
- Konfigurierbare Versandoptionen:
  - Einzel- oder Massenversand
  - Versandart (Standard, Einschreiben etc., sofern verfügbar)
- Übergabe der Druck- & Versanddaten an die Deutsche Post

---

### 5. Status- & Tracking-System
- Versandstatus abrufen und anzeigen (z. B. „In Verarbeitung“, „Gedruckt“, „Versendet“)
- Fehlerhandling & Retry-Mechanismen
- Historie aller Sendungen

---

## 🔐 Sicherheit & Compliance
- Verschlüsselung sensibler Daten (z. B. AES-256)
- Sichere Secrets-Verwaltung (ENV / Vault)
- Audit-Logs
- DSGVO: Datenminimierung, Löschkonzepte
- Rate-Limiting & Schutz vor Missbrauch

---

## 🏗️ Architektur-Anforderungen
- Saubere **Layered / Hexagonal Architecture**
- Trennung von:
  - Frontend
  - Backend
  - Integrationslayer (Deutsche Post)
- API-First-Ansatz
- Vorbereitung auf Skalierung (Container, Stateless Services)

---

## 🛠️ Technologievorschläge (kannst du begründet anpassen)
- **Frontend**: React / Next.js + TypeScript
- **Backend**: Node.js (NestJS) oder alternativ Spring Boot
- **Datenbank**: PostgreSQL
- **Auth**: JWT + Refresh Tokens
- **File Storage**: S3-kompatibel
- **Deployment**: Docker + CI/CD
- **Testing**: Unit-, Integration- & E2E-Tests

---

## 📦 Deliverables
Bitte liefere:
1. Gesamtarchitektur (Diagramm in Textform)
2. Datenbank-Schema
3. API-Endpunkte (REST, OpenAPI-Style)
4. Sicherheitskonzept
5. Beispiel-Code für:
   - Auth
   - Dokumenten-Upload
   - Deutsche-Post-Integration
6. Empfehlungen für produktiven Betrieb

---

## ⚠️ Wichtige Annahmen
- Falls keine offizielle API der Deutschen Post existiert, beschreibe:
  - mögliche technische Alternativen
  - Risiken & rechtliche Hinweise
- Markiere alle Annahmen explizit

---

## 🧠 Arbeitsweise
- Denke **produktionsorientiert**
- Triff sinnvolle technische Entscheidungen
- Erkläre kurz *warum* du etwas so umsetzt
- Schreibe klar, strukturiert und umsetzbar

---

**Starte mit einer High-Level-Architektur und arbeite dich dann Schritt für Schritt ins Detail vor.**
