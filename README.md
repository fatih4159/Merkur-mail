# Merkur Mail

**Professional Print Mailing Service powered by Deutsche Post**

Merkur Mail ist eine moderne, produktionsbereite Web-Applikation, die es Unternehmen ermöglicht, Print-Mailing-Dienste der Deutschen Post digital zu nutzen.

## 🚀 Features

- ✅ **Benutzer- & Zugriffsverwaltung** mit JWT & 2FA
- ✅ **Dokumenten-Management** mit Validierung und Vorschau
- ✅ **Deutsche Post Integration** mit verschlüsselter Zugangsdaten-Speicherung
- ✅ **Versand-Tracking** & Historie
- ✅ **REST API** für externe Systeme
- ✅ **DSGVO-konform** mit Audit-Logging
- ✅ **Skalierbar** mit Docker & Kubernetes

## 📦 Technologie-Stack

### Backend
- **NestJS** - Enterprise TypeScript Framework
- **PostgreSQL** - Relationale Datenbank
- **Prisma** - Type-safe ORM
- **JWT** - Authentifizierung
- **Argon2** - Password Hashing

### Frontend
- **Next.js 14** - React Framework mit App Router
- **TypeScript** - Type Safety
- **Tailwind CSS** - Utility-first CSS
- **React Query** - Data Fetching
- **shadcn/ui** - UI Components

### Infrastructure
- **Docker** - Containerization
- **Nixpacks** - Zero-config deployment (Railway/Render)
- **GitHub Actions** - CI/CD
- **MinIO** - S3-compatible storage

## 🏗️ Projekt-Struktur

```
merkur-mail/
├── apps/
│   ├── backend/          # NestJS Backend API
│   │   ├── src/
│   │   ├── prisma/
│   │   └── package.json
│   └── frontend/         # Next.js Frontend
│       ├── src/
│       └── package.json
├── packages/             # Shared code (future)
├── docker/               # Docker configurations
├── docs/                 # Documentation
│   ├── architecture.md
│   ├── database-schema.md
│   ├── api-specification.md
│   └── security-concept.md
└── package.json          # Root workspace
```

## 🛠️ Setup & Installation

### Voraussetzungen

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** & Docker Compose (optional)
- **PostgreSQL** 15+ (oder via Docker)

### 1. Repository klonen

```bash
git clone https://github.com/yourusername/merkur-mail.git
cd merkur-mail
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Environment Variables

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env

# Frontend
cp apps/frontend/.env.example apps/frontend/.env
```

Bearbeite die `.env` Dateien mit deinen Konfigurationen.

### 4. Datenbank starten (Docker)

```bash
docker-compose up -d postgres minio redis
```

### 5. Datenbank migrieren

```bash
cd apps/backend
npx prisma migrate dev
npx prisma generate
```

### 6. Entwicklungsserver starten

```bash
# Root-Verzeichnis
npm run dev

# Oder einzeln:
npm run dev:backend  # Backend: http://localhost:3001
npm run dev:frontend # Frontend: http://localhost:3000
```

### 7. API Dokumentation

Nach dem Start des Backends ist die Swagger-Dokumentation verfügbar unter:

```
http://localhost:3001/api/docs
```

## 🐳 Docker Setup (Komplett)

Starte alle Services mit Docker Compose:

```bash
docker-compose up -d
```

Services:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **MinIO Console**: http://localhost:9001
- **PostgreSQL**: localhost:5432

## 🚢 Deployment

### Railway / Render (Nixpacks)

Dieses Projekt ist für Nixpacks-Deployment optimiert:

1. Erstelle zwei Services (Backend & Frontend)
2. Verbinde mit GitHub Repository
3. Wähle Workspace-Pfad:
   - Backend: `apps/backend`
   - Frontend: `apps/frontend`
4. Setze Environment Variables
5. Deploy!

**Backend Environment Variables**:
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
ENCRYPTION_KEY=your-encryption-key
```

**Frontend Environment Variables**:
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api/v1
```

### Docker (Production)

```bash
docker build -t merkurmail-backend -f docker/backend/Dockerfile .
docker build -t merkurmail-frontend -f docker/frontend/Dockerfile .
```

## 🧪 Testing

```bash
# Alle Tests
npm run test

# Backend Tests
npm run test --workspace=apps/backend

# Mit Coverage
npm run test:cov
```

## 📝 Scripts

```bash
# Development
npm run dev              # Start all services
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only

# Build
npm run build            # Build all
npm run build:backend    # Backend only
npm run build:frontend   # Frontend only

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run db:reset         # Reset database

# Linting & Formatting
npm run lint             # Lint all
npm run lint:fix         # Fix linting issues
npm run format           # Format code

# Docker
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services
```

## 📚 Dokumentation

Ausführliche Dokumentation findest du im `docs/` Verzeichnis:

- [**Architektur**](docs/architecture.md) - System-Architektur & Design
- [**Datenbank-Schema**](docs/database-schema.md) - Vollständiges DB-Schema
- [**API-Spezifikation**](docs/api-specification.md) - REST API Endpoints
- [**Sicherheitskonzept**](docs/security-concept.md) - Security Best Practices

## 🔐 Sicherheit

- ✅ JWT + Refresh Tokens
- ✅ Argon2 Password Hashing
- ✅ AES-256-GCM Verschlüsselung
- ✅ Rate Limiting
- ✅ CORS & CSRF Protection
- ✅ Input Validation
- ✅ SQL Injection Prevention
- ✅ XSS Protection

## 📄 Lizenz

**UNLICENSED** - Proprietary Software

## 👥 Team

Entwickelt vom **Merkur Mail Team**

## 🐛 Bug Reports & Feature Requests

Bitte erstelle ein Issue im GitHub Repository.

---

**Status**: 🚧 In Entwicklung - Phase 2 abgeschlossen

**Version**: 1.0.0