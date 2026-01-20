# Merkur Mail - Sicherheitskonzept

**Version**: 1.0.0
**Datum**: 2024-01-20
**Status**: In Bearbeitung

---

## 1. Sicherheits-Übersicht

### 1.1 Schutzziele
- **Vertraulichkeit**: Schutz sensibler Daten (Credentials, Dokumente, Adressen)
- **Integrität**: Unveränderbarkeit von Dokumenten und Versandaufträgen
- **Verfügbarkeit**: 99.9% Uptime (SLA)
- **Authentizität**: Eindeutige Identifikation von Benutzern und Systemen
- **Nachvollziehbarkeit**: Lückenlose Audit-Trails (DSGVO)

### 1.2 Bedrohungsmodell
| Bedrohung | Risiko | Gegenmaßnahme |
|-----------|--------|---------------|
| SQL Injection | Hoch | Prepared Statements, ORM |
| XSS (Cross-Site Scripting) | Mittel | CSP, Input Sanitization |
| CSRF (Cross-Site Request Forgery) | Mittel | CSRF Tokens, SameSite Cookies |
| Brute Force Attacks | Hoch | Rate Limiting, Account Lockout |
| Man-in-the-Middle | Hoch | TLS 1.3, Certificate Pinning |
| Credential Theft | Kritisch | Argon2, 2FA, Encrypted Storage |
| DDoS Attacks | Mittel | Rate Limiting, WAF, CDN |
| Insider Threats | Mittel | Audit Logs, Least Privilege |
| API Abuse | Hoch | Rate Limiting, API Keys |

---

## 2. Authentifizierung & Autorisierung

### 2.1 Password Policy
```typescript
interface PasswordRequirements {
  minLength: 12;
  requireUppercase: true;
  requireLowercase: true;
  requireNumbers: true;
  requireSpecialChars: true;
  preventCommonPasswords: true; // Top 10k Common Passwords
  preventUserInfo: true; // Email, Name, etc.
}
```

**Beispiel-Validierung**:
```
✓ SecureP@ssw0rd2024!
✗ password123 (zu schwach)
✗ user@example.com (enthält Benutzerinfo)
```

### 2.2 Password Hashing
**Algorithmus**: Argon2id (OWASP Empfehlung)

```typescript
import * as argon2 from 'argon2';

// Hashing
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
  saltLength: 16
});

// Verification
const isValid = await argon2.verify(hash, password);
```

**Alternative**: bcrypt (min. 12 rounds)

### 2.3 JWT (JSON Web Tokens)

#### Access Token
- **Lebensdauer**: 15 Minuten
- **Algorithmus**: RS256 (RSA + SHA-256)
- **Payload**:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "roles": ["user"],
  "iat": 1642684800,
  "exp": 1642685700,
  "jti": "token-uuid"
}
```

#### Refresh Token
- **Lebensdauer**: 7 Tage
- **Speicherung**: Database (mit Hash)
- **Rotation**: Bei jedem Refresh neuen Token generieren
- **Revocation**: Bei Logout/Sicherheitsvorfall invalidieren

```typescript
// Token Generation
const accessToken = jwt.sign(payload, privateKey, {
  algorithm: 'RS256',
  expiresIn: '15m',
  issuer: 'merkurmail.de',
  audience: 'merkurmail-api'
});

const refreshToken = jwt.sign(payload, privateKey, {
  algorithm: 'RS256',
  expiresIn: '7d',
  jti: uuidv4() // Unique Token ID
});
```

### 2.4 Two-Factor Authentication (2FA)

**Methode**: TOTP (Time-based One-Time Password)

```typescript
import * as speakeasy from 'speakeasy';

// Setup
const secret = speakeasy.generateSecret({
  name: 'Merkur Mail (user@example.com)',
  issuer: 'Merkur Mail'
});

// QR Code für Authenticator-App generieren
const qrCodeUrl = secret.otpauth_url;

// Verification
const isValid = speakeasy.totp.verify({
  secret: secret.base32,
  encoding: 'base32',
  token: userToken,
  window: 1 // ±30 Sekunden Toleranz
});
```

**Unterstützte Apps**:
- Google Authenticator
- Authy
- Microsoft Authenticator

### 2.5 Role-Based Access Control (RBAC)

```typescript
enum Permission {
  // Users
  'users:read',
  'users:write',
  'users:delete',

  // Documents
  'documents:read',
  'documents:write',
  'documents:delete',

  // Mailings
  'mailings:read',
  'mailings:send',
  'mailings:cancel',

  // Admin
  'admin:users',
  'admin:audit-logs',
  'admin:settings'
}

const roles = {
  user: [
    'documents:read',
    'documents:write',
    'documents:delete',
    'mailings:read',
    'mailings:send'
  ],
  admin: ['*'] // All permissions
};
```

**Implementierung**:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Get('/admin/users')
async getUsers() {
  // Only admins can access
}
```

---

## 3. Datenverschlüsselung

### 3.1 Verschlüsselung in Transit (TLS)

**Konfiguration**:
```nginx
server {
    listen 443 ssl http2;
    server_name api.merkurmail.de;

    # TLS Version
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_prefer_server_ciphers on;

    # Cipher Suites (nur starke)
    ssl_ciphers 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256';

    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Certificate
    ssl_certificate /etc/ssl/certs/merkurmail.crt;
    ssl_certificate_key /etc/ssl/private/merkurmail.key;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
}
```

**SSL Labs Score**: A+

### 3.2 Verschlüsselung at Rest

#### 3.2.1 Deutsche Post Credentials (AES-256-GCM)

```typescript
import * as crypto from 'crypto';

class CredentialsEncryption {
  private algorithm = 'aes-256-gcm';
  private key: Buffer; // 32 bytes from ENV

  constructor() {
    // Key aus Environment Variable (rotiert monatlich)
    this.key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

**Key Management**:
- Keys in AWS Secrets Manager / HashiCorp Vault
- Automatische Rotation alle 90 Tage
- Alte Keys für Entschlüsselung beibehalten (Grace Period: 30 Tage)

#### 3.2.2 Database Encryption

```sql
-- PostgreSQL TDE (Transparent Data Encryption)
-- Aktiviert auf Datenbankebene

-- Zusätzlich: Column-Level Encryption für besonders sensible Daten
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Beispiel: Verschlüsselte Speicherung
INSERT INTO user_credentials (user_id, username_encrypted, password_encrypted)
VALUES (
  'uuid',
  pgp_sym_encrypt('username', 'encryption_key'),
  pgp_sym_encrypt('password', 'encryption_key')
);

-- Entschlüsselung
SELECT
  user_id,
  pgp_sym_decrypt(username_encrypted::bytea, 'encryption_key') as username
FROM user_credentials;
```

#### 3.2.3 File Storage Encryption (S3)

```typescript
// Server-Side Encryption mit AWS KMS
const s3Client = new S3Client({
  region: 'eu-central-1'
});

await s3Client.send(new PutObjectCommand({
  Bucket: 'merkurmail-documents',
  Key: `documents/${userId}/${documentId}.pdf`,
  Body: fileBuffer,
  ServerSideEncryption: 'aws:kms',
  SSEKMSKeyId: process.env.KMS_KEY_ID,
  ContentType: 'application/pdf'
}));
```

**Alternativen**:
- MinIO mit SSE-S3 / SSE-KMS
- Client-Side Encryption vor Upload

---

## 4. Input Validation & Sanitization

### 4.1 Backend Validation

```typescript
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import * as DOMPurify from 'isomorphic-dompurify';

class RegisterDto {
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => DOMPurify.sanitize(value))
  firstName: string;
}
```

### 4.2 SQL Injection Prevention

```typescript
// ✓ SICHER: Prepared Statements (ORM)
const user = await this.userRepository.findOne({
  where: { email }
});

// ✗ UNSICHER: String Concatenation
const query = `SELECT * FROM users WHERE email = '${email}'`; // NEVER!
```

### 4.3 XSS Prevention

**Content Security Policy (CSP)**:
```typescript
// NestJS Helmet Middleware
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Minimieren!
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.merkurmail.de'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));
```

**Output Encoding**:
```typescript
// Frontend (React)
// Automatisches Escaping durch JSX
<div>{userInput}</div> // Sicher

// Unsicher (vermeiden!):
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### 4.4 CSRF Protection

```typescript
// NestJS CSRF Middleware
import * as csurf from 'csurf';

app.use(csurf({
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: true // nur HTTPS
  }
}));
```

**Frontend**:
```typescript
// CSRF Token in Header senden
fetch('/api/documents', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken
  },
  body: formData
});
```

---

## 5. Rate Limiting & DDoS Protection

### 5.1 Application-Level Rate Limiting

```typescript
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // 60 Sekunden
      limit: 60 // 60 Requests
    })
  ]
})
export class AppModule {}

// Controller-Level Override
@UseGuards(ThrottlerGuard)
@Throttle(10, 60) // 10 Requests pro Minute
@Post('/auth/login')
async login() {
  // ...
}
```

### 5.2 Redis-basiertes Rate Limiting

```typescript
import Redis from 'ioredis';

class RateLimiter {
  private redis: Redis;

  async checkLimit(key: string, limit: number, window: number): Promise<boolean> {
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, window);
    }

    return current <= limit;
  }
}

// Usage
const allowed = await rateLimiter.checkLimit(
  `ratelimit:${userId}:documents`,
  100, // 100 Requests
  3600 // pro Stunde
);
```

### 5.3 WAF (Web Application Firewall)

**Cloudflare / AWS WAF Rules**:
- OWASP Core Rule Set
- IP Reputation Lists
- Geo-Blocking (optional)
- Rate-Based Rules

---

## 6. Secrets Management

### 6.1 Environment Variables

```bash
# .env (NEVER commit to Git!)
DATABASE_URL=postgresql://user:password@localhost:5432/merkurmail
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
DEUTSCHE_POST_API_KEY=...
```

**Sicherheit**:
- `.env` in `.gitignore`
- Unterschiedliche Secrets für Dev/Staging/Prod
- Keine Secrets im Code oder Logs

### 6.2 HashiCorp Vault (Production)

```typescript
import * as vault from 'node-vault';

const vaultClient = vault({
  endpoint: 'https://vault.merkurmail.de',
  token: process.env.VAULT_TOKEN
});

// Secret abrufen
const secret = await vaultClient.read('secret/data/merkurmail/prod');
const dbPassword = secret.data.data.database_password;
```

**Features**:
- Dynamic Secrets (rotieren automatisch)
- Audit Logs
- Encryption as a Service

---

## 7. Audit Logging & Monitoring

### 7.1 Security Events

**Zu loggende Events**:
```typescript
enum SecurityEvent {
  // Authentication
  'auth.login.success',
  'auth.login.failed',
  'auth.logout',
  'auth.password_reset',
  'auth.2fa_enabled',
  'auth.2fa_disabled',

  // Authorization
  'authz.access_denied',
  'authz.privilege_escalation_attempt',

  // Data Access
  'data.credentials.created',
  'data.credentials.accessed',
  'data.credentials.deleted',
  'data.document.uploaded',
  'data.document.downloaded',
  'data.mailing.sent',

  // Admin
  'admin.user.created',
  'admin.user.deleted',
  'admin.settings.changed'
}
```

**Log-Format**:
```json
{
  "timestamp": "2024-01-20T11:10:00.000Z",
  "event": "auth.login.success",
  "userId": "uuid",
  "userEmail": "user@example.com",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "metadata": {
    "method": "email",
    "2faUsed": true
  },
  "severity": "INFO"
}
```

### 7.2 Intrusion Detection

**Anomalie-Erkennung**:
- Multiple fehlgeschlagene Logins (5 in 10 Minuten)
- Login aus ungewöhnlicher Geo-Location
- Massendownload von Dokumenten
- API-Zugriff außerhalb üblicher Zeiten

**Reaktion**:
```typescript
async detectAnomalies(userId: string) {
  // Failed Login Attempts
  const failedLogins = await this.auditLogRepository.count({
    where: {
      userId,
      event: 'auth.login.failed',
      createdAt: MoreThan(new Date(Date.now() - 10 * 60 * 1000))
    }
  });

  if (failedLogins >= 5) {
    await this.lockAccount(userId);
    await this.notifySecurityTeam({
      event: 'potential_brute_force',
      userId
    });
  }
}
```

### 7.3 SIEM Integration

**Security Information and Event Management**:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Datadog Security Monitoring

**Alert Rules**:
- Privilege escalation attempts
- Unusual data exfiltration patterns
- Failed authentication spikes
- Suspicious API usage

---

## 8. Dependency Security

### 8.1 Vulnerability Scanning

```bash
# NPM Audit
npm audit
npm audit fix

# Snyk (automatisiert)
snyk test
snyk monitor

# Dependabot (GitHub)
# Automatische PRs für Security Updates
```

### 8.2 Supply Chain Security

**package.json Lock**:
```bash
# Exakte Versionen locken
npm ci # statt npm install
```

**Integrity Checks**:
```json
{
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "snyk": "^1.1000.0"
  },
  "overrides": {
    // Vulnerable Transitive Dependencies fixen
    "minimist": "^1.2.6"
  }
}
```

---

## 9. Incident Response Plan

### 9.1 Sicherheitsvorfall-Kategorien

| Kategorie | Beispiele | Response Time |
|-----------|-----------|---------------|
| **Critical** | Data Breach, System Compromise | < 1 Stunde |
| **High** | DDoS, Service Outage | < 4 Stunden |
| **Medium** | Suspicious Activity, Failed Intrusion | < 24 Stunden |
| **Low** | Policy Violation, Minor Anomaly | < 72 Stunden |

### 9.2 Response Playbook

**Phase 1: Detection**
- Automated Alerts (SIEM)
- User Reports
- Security Scanning

**Phase 2: Containment**
```typescript
async containSecurityIncident(incidentType: string) {
  switch (incidentType) {
    case 'credential_compromise':
      // Alle Tokens invalidieren
      await this.revokeAllUserTokens(affectedUserId);
      // Account sperren
      await this.lockAccount(affectedUserId);
      // User benachrichtigen
      await this.notifyUser(affectedUserId, 'security_incident');
      break;

    case 'api_abuse':
      // Rate Limits verschärfen
      await this.updateRateLimit(affectedApiKey, 0);
      // IP blocken
      await this.blockIP(sourceIP);
      break;
  }
}
```

**Phase 3: Eradication**
- Schwachstelle patchen
- Kompromittierte Credentials rotieren
- Malware entfernen

**Phase 4: Recovery**
- Services wiederherstellen
- Daten aus Backup wiederherstellen
- Betroffene Nutzer informieren

**Phase 5: Lessons Learned**
- Post-Mortem erstellen
- Prozesse verbessern
- Team schulen

---

## 10. Compliance & DSGVO

### 10.1 Datenminimierung
```typescript
// Nur notwendige Daten speichern
interface UserData {
  // ✓ Notwendig
  email: string;
  passwordHash: string;

  // ✗ Nicht notwendig (vermeiden!)
  // socialSecurityNumber: string;
  // birthDate: string;
}
```

### 10.2 Recht auf Löschung (Art. 17 DSGVO)

```typescript
async deleteUserData(userId: string) {
  // 1. User markieren
  await this.userRepository.update(userId, {
    deletedAt: new Date(),
    email: `deleted_${userId}@deleted.local`,
    firstName: '[DELETED]',
    lastName: '[DELETED]'
  });

  // 2. Credentials löschen
  await this.credentialsRepository.delete({ userId });

  // 3. Dokumente löschen (S3)
  await this.s3Service.deleteFolder(`documents/${userId}`);

  // 4. Audit-Log
  await this.auditLog.create({
    userId,
    action: 'user.gdpr_deletion',
    status: 'success'
  });

  // 5. Nach 30 Tagen: Hard Delete via Cron Job
}
```

### 10.3 Datenexport (Art. 20 DSGVO)

```typescript
@Get('/users/me/export')
async exportUserData(@CurrentUser() user: User) {
  const userData = await this.userService.exportAllData(user.id);

  // JSON Format
  return {
    personal: userData.personal,
    documents: userData.documents,
    mailings: userData.mailings,
    exportedAt: new Date()
  };
}
```

### 10.4 Einwilligung & Tracking

```typescript
interface ConsentSettings {
  necessary: true; // Immer aktiv
  analytics: boolean; // Optional
  marketing: boolean; // Optional
}

// Keine Cookies/Tracking ohne Einwilligung
if (user.consentSettings.analytics) {
  this.analyticsService.track('page_view', { page: '/dashboard' });
}
```

---

## 11. Security Testing

### 11.1 Automated Security Tests

```typescript
// Jest Security Tests
describe('Security: Password Hashing', () => {
  it('should hash passwords with Argon2', async () => {
    const password = 'SecureP@ssw0rd!';
    const hash = await authService.hashPassword(password);

    expect(hash).not.toEqual(password);
    expect(hash).toContain('$argon2id$');
  });

  it('should prevent weak passwords', async () => {
    const weakPassword = 'password123';

    await expect(
      authService.register({ password: weakPassword })
    ).rejects.toThrow('Password too weak');
  });
});
```

### 11.2 Penetration Testing

**Jährliche Pen-Tests durch externe Firma**:
- OWASP Top 10 Testing
- API Security Testing
- Infrastructure Assessment
- Social Engineering Tests

### 11.3 Bug Bounty Program

**Responsible Disclosure Policy**:
```
security@merkurmail.de

Rewards:
- Critical: 500€ - 5000€
- High: 250€ - 1000€
- Medium: 100€ - 500€
- Low: Hall of Fame

Scope:
✓ api.merkurmail.de
✓ app.merkurmail.de
✗ Third-party services
```

---

## 12. Security Checklist (Deployment)

### Pre-Production
- [ ] Alle Secrets in Vault/ENV (nicht im Code)
- [ ] TLS 1.3 aktiviert
- [ ] HSTS Header gesetzt
- [ ] CSP Header konfiguriert
- [ ] Rate Limiting aktiviert
- [ ] CSRF Protection aktiviert
- [ ] Input Validation auf allen Endpoints
- [ ] SQL Injection Tests bestanden
- [ ] XSS Tests bestanden
- [ ] Dependency Audit durchgeführt
- [ ] Security Headers (X-Frame-Options, etc.)
- [ ] Audit Logging funktioniert
- [ ] Backup & Recovery getestet
- [ ] DSGVO-Prozesse implementiert
- [ ] Incident Response Plan dokumentiert

### Post-Production
- [ ] Monitoring & Alerts konfiguriert
- [ ] SIEM Integration aktiv
- [ ] Vulnerability Scanning automatisiert
- [ ] Pen-Test durchgeführt
- [ ] Security Training für Team
- [ ] Dokumentation aktualisiert

---

## 13. Empfehlungen für produktiven Betrieb

### 13.1 Security Operations Center (SOC)
- 24/7 Monitoring
- Incident Response Team
- Security Automation (SOAR)

### 13.2 Regelmäßige Security Audits
- Quarterly: Internal Review
- Annually: External Pen-Test
- Continuously: Automated Scanning

### 13.3 Security Training
- Monatliche Security Awareness Sessions
- Phishing-Simulationen
- Secure Coding Guidelines

### 13.4 Zertifizierungen (optional)
- ISO 27001 (Information Security)
- SOC 2 Type II
- PCI DSS (falls Zahlungen)

---

## Nächste Schritte
1. Security-Tests in CI/CD integrieren
2. WAF-Regeln definieren
3. Pen-Test-Partner auswählen
4. Bug-Bounty-Programm starten
5. Security-Dokumentation für Kunden erstellen
