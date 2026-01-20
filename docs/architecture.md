# Merkur Mail - System-Architektur

## 1. High-Level-Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Frontend (React + TypeScript)                          │
│  - UI Components (shadcn/ui, Tailwind CSS)                      │
│  - State Management (Zustand/Redux)                             │
│  - Client-Side Routing                                          │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS / REST API
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  - Rate Limiting & Throttling                                   │
│  - Request Validation                                            │
│  - CORS Handling                                                 │
│  - API Versioning                                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  NestJS Backend (Node.js + TypeScript)                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Auth Module  │  │ User Module  │  │ Document     │         │
│  │              │  │              │  │ Module       │         │
│  │ - Login      │  │ - CRUD       │  │ - Upload     │         │
│  │ - Register   │  │ - Roles      │  │ - Validation │         │
│  │ - JWT/2FA    │  │ - DSGVO      │  │ - Metadata   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Mailing      │  │ Tracking     │  │ Audit        │         │
│  │ Module       │  │ Module       │  │ Module       │         │
│  │              │  │              │  │              │         │
│  │ - Send       │  │ - Status     │  │ - Logging    │         │
│  │ - Bulk       │  │ - History    │  │ - Compliance │         │
│  │ - Retry      │  │ - Webhook    │  │ - DSGVO      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────┬────────────────────┬───────────────────────┘
                     │                    │
                     ▼                    ▼
┌─────────────────────────────┐  ┌───────────────────────────────┐
│   Integration Layer          │  │   Data Layer                  │
├─────────────────────────────┤  ├───────────────────────────────┤
│  Deutsche Post Adapter       │  │  PostgreSQL Database          │
│                              │  │                               │
│  - Credentials Manager       │  │  ┌─────────────────────────┐ │
│  - API Client                │  │  │ Users & Roles           │ │
│  - Request/Response Mapper   │  │  │ Documents & Metadata    │ │
│  - Retry Logic               │  │  │ Mailings & Status       │ │
│  - Error Handling            │  │  │ Audit Logs              │ │
│  - Circuit Breaker           │  │  │ Encrypted Credentials   │ │
│                              │  │  └─────────────────────────┘ │
└──────────────┬──────────────┘  └───────────────────────────────┘
               │
               ▼
┌─────────────────────────────┐  ┌───────────────────────────────┐
│  Deutsche Post Print         │  │   Storage Layer               │
│  Mailing Service             │  ├───────────────────────────────┤
│  (External API/Web Portal)   │  │  S3-Compatible Storage        │
└─────────────────────────────┘  │  (MinIO / AWS S3)             │
                                  │  - Document Files             │
                                  │  - PDF Storage                │
                                  │  - Backup & Archiving         │
                                  └───────────────────────────────┘
```

## 2. Architektur-Prinzipien

### 2.1 Hexagonal Architecture (Ports & Adapters)
- **Core Business Logic** ist unabhängig von externen Diensten
- **Ports**: Interfaces für Kommunikation (z.B. `IMailingService`, `IDocumentStorage`)
- **Adapters**: Konkrete Implementierungen (z.B. `DeutschePostAdapter`, `S3StorageAdapter`)

### 2.2 Layered Architecture
```
Presentation Layer (Next.js)
      ↓
API Layer (NestJS Controllers)
      ↓
Business Logic Layer (Services)
      ↓
Data Access Layer (Repositories)
      ↓
Database Layer (PostgreSQL)
```

### 2.3 Separation of Concerns
- **Frontend**: Reine UI/UX, keine Business-Logik
- **Backend**: API-First, stateless Services
- **Integration**: Abstrahierte Deutsche Post Integration
- **Storage**: Entkoppelte File- und DB-Storage

## 3. Skalierbarkeit & Deployment

### 3.1 Container-Strategie
```
Docker Compose (Development):
- frontend-container (Next.js)
- backend-container (NestJS)
- database-container (PostgreSQL)
- storage-container (MinIO)
- redis-container (Session/Cache)

Nixpacks (Railway, Render, etc.):
- Automatisches Build-System
- Zero-Config Deployment
- Unterstützt Monorepo-Struktur
- Build-Cache für schnellere Deployments

Kubernetes (Production):
- Frontend: 2+ Replicas (Auto-Scaling)
- Backend: 3+ Replicas (Horizontal Scaling)
- Database: StatefulSet mit Backup
- Storage: Persistent Volume Claims
```

### 3.2 Stateless Design
- Keine Session-Daten in Backend-Services
- JWT für Authentication (Stateless)
- Redis für temporäre Caching (optional)

### 3.3 Load Balancing
- NGINX/Traefik als Reverse Proxy
- Round-Robin für Backend-Services
- Sticky Sessions nicht erforderlich (stateless)

### 3.4 Nixpacks Deployment (Railway/Render)

**Anforderungen**:
- Projekt muss mit Nixpacks buildbar sein (zero-config)
- Automatische Erkennung von Node.js/TypeScript
- Build-Konfiguration über `nixpacks.toml` oder `package.json`

**Beispiel-Struktur**:
```
merkur-mail/
├── apps/
│   ├── backend/          # NestJS
│   │   ├── package.json
│   │   └── nixpacks.toml (optional)
│   └── frontend/         # Next.js
│       ├── package.json
│       └── nixpacks.toml (optional)
└── package.json          # Root
```

**nixpacks.toml (Backend)**:
```toml
[phases.setup]
nixPkgs = ["nodejs_20", "postgresql"]

[phases.build]
cmds = ["npm install", "npm run build"]

[start]
cmd = "npm run start:prod"
```

**Environment Variables**:
```bash
NODE_ENV=production
DATABASE_URL=${{ secrets.DATABASE_URL }}
JWT_SECRET=${{ secrets.JWT_SECRET }}
PORT=3000
```

**Vorteile**:
- Schnelles Deployment ohne Docker-Komplexität
- Automatische Build-Optimierung
- Integrierte Health Checks
- Zero-Downtime Deployments

## 4. Sicherheits-Architektur

### 4.1 Netzwerk-Segmentierung
```
Internet
   ↓
Firewall/WAF
   ↓
Load Balancer (HTTPS only)
   ↓
Frontend (DMZ)
   ↓
Backend (Private Network)
   ↓
Database (Isolated Network)
```

### 4.2 Verschlüsselung
- **In Transit**: TLS 1.3 (HTTPS)
- **At Rest**:
  - AES-256 für Deutsche Post Credentials
  - Database Encryption (PostgreSQL TDE)
  - S3 Server-Side Encryption

### 4.3 Authentication & Authorization
```
User → Login Request
        ↓
    Validate Credentials (Argon2 Hash)
        ↓
    Generate JWT (Access + Refresh Token)
        ↓
    Protected Resources (Role-Based Access)
```

## 5. Daten-Fluss: Dokument-Versand

```
1. User Upload Document
        ↓
2. Frontend → API: POST /api/documents
        ↓
3. Validation (Format, Size, Pages)
        ↓
4. Upload to S3 Storage
        ↓
5. Save Metadata to Database
        ↓
6. User → Send Request
        ↓
7. API → Deutsche Post Adapter
        ↓
8. Decrypt Credentials
        ↓
9. API Call to Deutsche Post
        ↓
10. Save Status & Tracking Info
        ↓
11. Return Confirmation to User
```

## 6. Fehlerbehandlung & Resilienz

### 6.1 Retry-Mechanismus
- Exponential Backoff für Deutsche Post API
- Max. 3 Retry-Versuche
- Circuit Breaker Pattern

### 6.2 Monitoring & Logging
- Structured Logging (Winston/Pino)
- Application Performance Monitoring (APM)
- Error Tracking (Sentry)
- Metrics (Prometheus + Grafana)

## 7. DSGVO-Compliance

### 7.1 Datenminimierung
- Nur notwendige Daten speichern
- Pseudonymisierung wo möglich
- Automatische Löschung nach Retention-Period

### 7.2 Audit Trail
- Alle Zugriffe loggen
- User-Actions tracken
- DSGVO-konforme Löschung dokumentieren

## 8. Technologie-Stack

| Komponente | Technologie | Begründung |
|------------|-------------|------------|
| Frontend | Next.js 14+ (App Router) | SSR, SEO, Performance |
| UI Components | shadcn/ui + Tailwind CSS | Modern, Accessible, Customizable |
| Backend | NestJS | Structured, TypeScript, Enterprise-Ready |
| Database | PostgreSQL 15+ | ACID, JSON Support, Reliability |
| Auth | JWT + Argon2 | Stateless, Secure Hashing |
| File Storage | MinIO (S3-compatible) | Self-hosted, Scalable |
| Caching | Redis | Session, Rate-Limiting |
| Containerization | Docker + Docker Compose | Dev/Prod Parity |
| Build System | Nixpacks | Zero-Config, Railway/Render Support |
| Orchestration | Kubernetes (Prod) | Scaling, Self-Healing |
| CI/CD | GitHub Actions | Automated Testing & Deployment |

## 9. Entwicklungs-Roadmap

### Phase 1: Foundation (Wochen 1-2)
- Projekt-Setup
- Authentication & User Management
- Database Schema

### Phase 2: Core Features (Wochen 3-4)
- Document Upload & Validation
- Basic UI Components

### Phase 3: Integration (Wochen 5-6)
- Deutsche Post Adapter
- Mailing Functionality

### Phase 4: Advanced Features (Wochen 7-8)
- Tracking System
- API für externe Systeme
- Bulk Operations

### Phase 5: Security & Compliance (Wochen 9-10)
- Security Hardening
- DSGVO Implementation
- Audit System

### Phase 6: Testing & Deployment (Wochen 11-12)
- Comprehensive Testing
- Production Deployment
- Documentation

## 10. Offene Fragen & Annahmen

### ⚠️ Deutsche Post API
**Annahme**: Aktuell ist keine öffentliche REST-API der Deutschen Post für Print Mailing bekannt.

**Mögliche Lösungen**:
1. **Web Scraping/Automation** (z.B. Puppeteer/Playwright)
   - ⚠️ Rechtlich problematisch
   - ⚠️ Fragil bei UI-Änderungen
   - ❌ Nicht empfohlen

2. **Offizielle API-Anfrage bei Deutsche Post**
   - ✅ Rechtlich sauber
   - ✅ Stabil & supportet
   - ⏳ Zeitaufwändig

3. **Partner-Integration** (z.B. Drittanbieter)
   - ✅ Funktioniert sofort
   - 💰 Kostenpflichtig
   - ⚠️ Abhängigkeit

**Empfehlung**:
- Architektur mit Adapter-Pattern vorbereiten
- Deutsche Post kontaktieren für offizielle API
- Fallback: Partner-API als Zwischenlösung

### Nächste Schritte
1. Deutsche Post API-Verfügbarkeit klären
2. Rechtliche Bewertung einholen
3. Lizenzmodell definieren (SaaS-Preismodell)
