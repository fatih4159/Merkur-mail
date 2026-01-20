# Merkur Mail - Datenbank-Schema

## Datenbank: PostgreSQL 15+

## Entity-Relationship-Diagramm (Textform)

```
users (1) ────── (N) documents
  │                    │
  │                    │
  │                (N) mailings ──── (1) mailing_status
  │                    │
  │                    │
  │                (N) recipients
  │
  │
(1) user_credentials (1:1)
  │
(N) audit_logs
  │
(N) roles (M:N via user_roles)
```

---

## 1. users

Speichert Benutzerkonten.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Argon2
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255), -- Encrypted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete (DSGVO)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
```

---

## 2. roles

Rollen für Zugriffskontrolle.

```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL, -- 'admin', 'user', 'readonly'
    description TEXT,
    permissions JSONB, -- Flexible Permission-Liste
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default Roles
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Administrator mit vollen Rechten', '["*"]'),
('user', 'Standard-Benutzer', '["documents:read", "documents:write", "mailings:send"]'),
('readonly', 'Nur Lesezugriff', '["documents:read", "mailings:read"]');
```

---

## 3. user_roles

M:N Relation zwischen Users und Roles.

```sql
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
```

---

## 4. user_credentials

Verschlüsselte Zugangsdaten zur Deutschen Post.

```sql
CREATE TABLE user_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) DEFAULT 'deutsche_post', -- Erweiterbar
    username_encrypted TEXT NOT NULL, -- AES-256 Encrypted
    password_encrypted TEXT NOT NULL, -- AES-256 Encrypted
    is_verified BOOLEAN DEFAULT false,
    last_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_credentials_user_id ON user_credentials(user_id);
```

**Verschlüsselung**:
- AES-256-GCM mit rotierenden Keys
- Keys in Environment Variables oder Vault
- Nur im Anwendungscode entschlüsselt

---

## 5. documents

Hochgeladene Dokumente.

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL, -- S3 Path: 'documents/{user_id}/{uuid}.pdf'
    file_size BIGINT NOT NULL, -- in Bytes
    file_hash VARCHAR(64), -- SHA-256 für Deduplizierung
    mime_type VARCHAR(50) DEFAULT 'application/pdf',
    page_count INT,
    status VARCHAR(50) DEFAULT 'uploaded', -- 'uploaded', 'validated', 'processing', 'failed'
    metadata JSONB, -- Flexible Metadaten
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_documents_file_hash ON documents(file_hash);
```

**Validierung**:
- Max. 10MB pro Dokument (konfigurierbar)
- Nur PDF (erweiterbar auf DOCX)
- Max. 50 Seiten (Deutsche Post Limit)

---

## 6. recipients

Empfänger-Adressen.

```sql
CREATE TABLE recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(255),
    street VARCHAR(255) NOT NULL,
    house_number VARCHAR(20) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(2) DEFAULT 'DE', -- ISO 3166-1 alpha-2
    address_supplement VARCHAR(255),
    is_verified BOOLEAN DEFAULT false, -- Adressvalidierung
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recipients_user_id ON recipients(user_id);
CREATE INDEX idx_recipients_postal_code ON recipients(postal_code);
```

---

## 7. mailings

Versandaufträge.

```sql
CREATE TABLE mailings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES recipients(id) ON DELETE SET NULL,

    -- Snapshot der Empfänger-Daten (falls Recipient gelöscht wird)
    recipient_snapshot JSONB NOT NULL,

    mailing_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'registered', 'express'
    color_mode VARCHAR(20) DEFAULT 'bw', -- 'bw' (schwarz-weiß), 'color'
    double_sided BOOLEAN DEFAULT true,

    status_id UUID REFERENCES mailing_status(id),

    external_id VARCHAR(255), -- ID von Deutsche Post
    tracking_number VARCHAR(100),

    cost_estimate DECIMAL(10, 2),
    cost_actual DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'EUR',

    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,

    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mailings_user_id ON mailings(user_id);
CREATE INDEX idx_mailings_status_id ON mailings(status_id);
CREATE INDEX idx_mailings_external_id ON mailings(external_id);
CREATE INDEX idx_mailings_tracking_number ON mailings(tracking_number);
CREATE INDEX idx_mailings_created_at ON mailings(created_at DESC);
```

---

## 8. mailing_status

Status-Katalog für Mailings.

```sql
CREATE TABLE mailing_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_final BOOLEAN DEFAULT false, -- Endstatus (erfolgreich/fehlgeschlagen)
    is_error BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Standard Status
INSERT INTO mailing_status (code, name, description, is_final, is_error, sort_order) VALUES
('draft', 'Entwurf', 'Mailing noch nicht abgeschickt', false, false, 10),
('pending', 'Wartend', 'Warten auf Verarbeitung', false, false, 20),
('processing', 'In Verarbeitung', 'Wird an Deutsche Post übermittelt', false, false, 30),
('submitted', 'Übermittelt', 'Erfolgreich an Deutsche Post übermittelt', false, false, 40),
('printing', 'Wird gedruckt', 'Dokument wird gedruckt', false, false, 50),
('printed', 'Gedruckt', 'Dokument wurde gedruckt', false, false, 60),
('in_transit', 'Versandt', 'Im Versand', false, false, 70),
('delivered', 'Zugestellt', 'Erfolgreich zugestellt', true, false, 80),
('failed', 'Fehlgeschlagen', 'Versand fehlgeschlagen', true, true, 90),
('cancelled', 'Abgebrochen', 'Vom Benutzer abgebrochen', true, false, 100);
```

---

## 9. mailing_events

Event-Log für Mailing-Status-Änderungen (Tracking).

```sql
CREATE TABLE mailing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailing_id UUID REFERENCES mailings(id) ON DELETE CASCADE,
    status_id UUID REFERENCES mailing_status(id),
    event_type VARCHAR(50), -- 'status_change', 'error', 'info'
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mailing_events_mailing_id ON mailing_events(mailing_id);
CREATE INDEX idx_mailing_events_created_at ON mailing_events(created_at DESC);
```

---

## 10. audit_logs

DSGVO-konformes Audit-Log.

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'user.login', 'document.upload', 'mailing.send'
    entity_type VARCHAR(50), -- 'user', 'document', 'mailing'
    entity_id UUID,
    ip_address INET,
    user_agent TEXT,
    request_data JSONB,
    response_data JSONB,
    status VARCHAR(20), -- 'success', 'error'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
```

**Retention**:
- 12 Monate für operative Logs
- 3 Jahre für DSGVO-relevante Zugriffe
- Automatisches Archivieren/Löschen

---

## 11. refresh_tokens

JWT Refresh Tokens.

```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 Hash
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

**Strategie**:
- Access Token: 15 Minuten
- Refresh Token: 7 Tage
- Rotation bei jedem Refresh

---

## 12. api_keys

API-Keys für externe Systeme.

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 Hash
    key_prefix VARCHAR(10), -- Ersten 8 Zeichen zur Identifikation
    permissions JSONB, -- Eingeschränkte Permissions
    rate_limit_per_minute INT DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
```

---

## 13. system_settings

Globale System-Einstellungen.

```sql
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Beispiel-Einstellungen
INSERT INTO system_settings (key, value, description, is_public) VALUES
('max_document_size_mb', '10', 'Maximale Dokumentengröße in MB', true),
('max_pages_per_document', '50', 'Maximale Seitenzahl pro Dokument', true),
('allowed_file_types', '["application/pdf"]', 'Erlaubte MIME-Types', true),
('retention_period_days', '90', 'Aufbewahrungsfrist für Dokumente in Tagen', false),
('deutsche_post_api_enabled', 'false', 'Deutsche Post API aktiviert', false);
```

---

## Datenbank-Sicherheit

### 1. Verschlüsselung
```sql
-- PostgreSQL Transparent Data Encryption (TDE)
-- Aktiviert auf DB-Level

-- Row-Level Security (RLS) Beispiel
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_user_policy ON documents
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID);
```

### 2. Backup-Strategie
- **Daily**: Full Backup (Retention: 30 Tage)
- **Hourly**: Incremental Backup (Retention: 7 Tage)
- **WAL**: Continuous Archiving (Point-in-Time Recovery)

### 3. Berechtigungen
```sql
-- App-User (Read/Write)
CREATE USER merkur_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE merkur_mail TO merkur_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO merkur_app;

-- Read-Only User (für Reporting)
CREATE USER merkur_readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE merkur_mail TO merkur_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO merkur_readonly;
```

---

## DSGVO-Compliance

### 1. Recht auf Löschung
```sql
-- Soft Delete Funktion
CREATE OR REPLACE FUNCTION soft_delete_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- User markieren
    UPDATE users SET deleted_at = NOW() WHERE id = p_user_id;

    -- Dokumente löschen (S3 Cleanup via Trigger)
    UPDATE documents SET deleted_at = NOW() WHERE user_id = p_user_id;

    -- Credentials löschen
    DELETE FROM user_credentials WHERE user_id = p_user_id;

    -- Audit-Log
    INSERT INTO audit_logs (user_id, action, status)
    VALUES (p_user_id, 'user.gdpr_deletion', 'success');
END;
$$ LANGUAGE plpgsql;
```

### 2. Daten-Export (DSGVO Art. 20)
```sql
CREATE OR REPLACE FUNCTION export_user_data(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'user', (SELECT row_to_json(u) FROM users u WHERE id = p_user_id),
        'documents', (SELECT jsonb_agg(row_to_json(d)) FROM documents d WHERE user_id = p_user_id),
        'mailings', (SELECT jsonb_agg(row_to_json(m)) FROM mailings m WHERE user_id = p_user_id),
        'recipients', (SELECT jsonb_agg(row_to_json(r)) FROM recipients r WHERE user_id = p_user_id)
    );
END;
$$ LANGUAGE plpgsql;
```

---

## Migrations

### Versionierung mit TypeORM/Prisma
```typescript
// Beispiel Migration
export class InitialSchema1234567890 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE users (...)`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE users`);
    }
}
```

---

## Performance-Optimierungen

### 1. Partitionierung (für große Tabellen)
```sql
-- Audit Logs nach Monat partitionieren
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 2. Materialized Views
```sql
-- Dashboard-Statistiken
CREATE MATERIALIZED VIEW user_statistics AS
SELECT
    user_id,
    COUNT(DISTINCT document_id) as total_documents,
    COUNT(DISTINCT mailing_id) as total_mailings,
    SUM(cost_actual) as total_cost
FROM mailings
GROUP BY user_id;

-- Täglich aktualisieren
REFRESH MATERIALIZED VIEW CONCURRENTLY user_statistics;
```

---

## Nächste Schritte
1. Prisma Schema erstellen
2. Seed-Daten für Entwicklung
3. Migration-Scripts
4. Performance-Tests mit größeren Datasets
