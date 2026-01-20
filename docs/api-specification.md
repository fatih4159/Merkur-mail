# Merkur Mail - API Specification

**Version**: 1.0.0
**Base URL**: `https://api.merkurmail.de/v1`
**Protocol**: REST over HTTPS
**Format**: JSON

---

## Authentifizierung

### Bearer Token (JWT)
```http
Authorization: Bearer {access_token}
```

### API Key (für externe Systeme)
```http
X-API-Key: {api_key}
```

---

## 1. Authentication & User Management

### 1.1 POST /auth/register
Registrierung eines neuen Benutzers.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd!",
  "firstName": "Max",
  "lastName": "Mustermann",
  "companyName": "Musterfirma GmbH"
}
```

**Response** (201 Created):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Max",
    "lastName": "Mustermann",
    "isVerified": false
  },
  "message": "Bestätigungs-E-Mail wurde gesendet"
}
```

**Errors**:
- `400`: Validation Error
- `409`: E-Mail bereits registriert

---

### 1.2 POST /auth/login
Login eines Benutzers.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd!"
}
```

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Max",
    "roles": ["user"]
  }
}
```

**Errors**:
- `401`: Ungültige Anmeldedaten
- `403`: Account nicht aktiviert

---

### 1.3 POST /auth/refresh
Access Token erneuern.

**Request**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

---

### 1.4 POST /auth/logout
Logout (Token invalidieren).

**Request**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response** (200 OK):
```json
{
  "message": "Erfolgreich abgemeldet"
}
```

---

### 1.5 GET /users/me
Aktuellen Benutzer abrufen.

**Response** (200 OK):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Max",
  "lastName": "Mustermann",
  "companyName": "Musterfirma GmbH",
  "isVerified": true,
  "twoFactorEnabled": false,
  "roles": ["user"],
  "createdAt": "2024-01-20T10:30:00Z"
}
```

---

### 1.6 PATCH /users/me
Benutzerprofil aktualisieren.

**Request**:
```json
{
  "firstName": "Maximilian",
  "companyName": "Neue Firma GmbH"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Maximilian",
  "companyName": "Neue Firma GmbH"
}
```

---

### 1.7 DELETE /users/me
Benutzeraccount löschen (DSGVO).

**Response** (200 OK):
```json
{
  "message": "Account wurde zur Löschung vorgemerkt. Die Daten werden innerhalb von 30 Tagen vollständig gelöscht."
}
```

---

## 2. Deutsche Post Credentials

### 2.1 POST /credentials/deutsche-post
Zugangsdaten speichern.

**Request**:
```json
{
  "username": "postuser123",
  "password": "PostP@ssw0rd!"
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "provider": "deutsche_post",
  "isVerified": false,
  "createdAt": "2024-01-20T10:30:00Z"
}
```

---

### 2.2 POST /credentials/deutsche-post/verify
Zugangsdaten verifizieren.

**Response** (200 OK):
```json
{
  "isVerified": true,
  "message": "Zugangsdaten erfolgreich verifiziert",
  "verifiedAt": "2024-01-20T10:35:00Z"
}
```

**Errors**:
- `401`: Ungültige Zugangsdaten
- `503`: Deutsche Post Service nicht erreichbar

---

### 2.3 GET /credentials/deutsche-post
Zugangsdaten-Status abrufen.

**Response** (200 OK):
```json
{
  "id": "uuid",
  "provider": "deutsche_post",
  "username": "postuser123", // Nur Username, kein Passwort
  "isVerified": true,
  "lastVerifiedAt": "2024-01-20T10:35:00Z"
}
```

---

### 2.4 DELETE /credentials/deutsche-post
Zugangsdaten löschen.

**Response** (200 OK):
```json
{
  "message": "Zugangsdaten wurden gelöscht"
}
```

---

## 3. Documents

### 3.1 POST /documents
Dokument hochladen.

**Request** (multipart/form-data):
```
file: [PDF Binary]
metadata: {
  "description": "Rechnung Januar 2024",
  "tags": ["rechnung", "2024"]
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "fileName": "invoice_jan2024.pdf",
  "fileSize": 524288,
  "mimeType": "application/pdf",
  "pageCount": 3,
  "status": "validated",
  "metadata": {
    "description": "Rechnung Januar 2024",
    "tags": ["rechnung", "2024"]
  },
  "createdAt": "2024-01-20T10:40:00Z"
}
```

**Errors**:
- `400`: Ungültiges Dateiformat
- `413`: Datei zu groß (max. 10 MB)
- `422`: Zu viele Seiten (max. 50)

---

### 3.2 GET /documents
Alle Dokumente abrufen (paginiert).

**Query Parameters**:
- `page`: Seite (default: 1)
- `limit`: Anzahl pro Seite (default: 20, max: 100)
- `status`: Filter nach Status
- `sortBy`: Sortierung (createdAt, fileName)
- `order`: asc/desc

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "fileName": "invoice_jan2024.pdf",
      "fileSize": 524288,
      "pageCount": 3,
      "status": "validated",
      "createdAt": "2024-01-20T10:40:00Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### 3.3 GET /documents/:id
Einzelnes Dokument abrufen.

**Response** (200 OK):
```json
{
  "id": "uuid",
  "fileName": "invoice_jan2024.pdf",
  "fileSize": 524288,
  "mimeType": "application/pdf",
  "pageCount": 3,
  "status": "validated",
  "metadata": {
    "description": "Rechnung Januar 2024",
    "tags": ["rechnung", "2024"]
  },
  "downloadUrl": "https://cdn.merkurmail.de/documents/signed-url",
  "thumbnailUrl": "https://cdn.merkurmail.de/thumbnails/signed-url",
  "createdAt": "2024-01-20T10:40:00Z"
}
```

---

### 3.4 GET /documents/:id/download
Dokument herunterladen.

**Response** (200 OK):
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="invoice_jan2024.pdf"

[PDF Binary]
```

---

### 3.5 DELETE /documents/:id
Dokument löschen.

**Response** (200 OK):
```json
{
  "message": "Dokument wurde gelöscht"
}
```

---

## 4. Recipients

### 4.1 POST /recipients
Empfänger erstellen.

**Request**:
```json
{
  "firstName": "Erika",
  "lastName": "Mustermann",
  "company": "Musterfirma GmbH",
  "street": "Musterstraße",
  "houseNumber": "42",
  "postalCode": "12345",
  "city": "Berlin",
  "country": "DE",
  "addressSupplement": "3. OG"
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "firstName": "Erika",
  "lastName": "Mustermann",
  "company": "Musterfirma GmbH",
  "street": "Musterstraße",
  "houseNumber": "42",
  "postalCode": "12345",
  "city": "Berlin",
  "country": "DE",
  "isVerified": false,
  "createdAt": "2024-01-20T10:45:00Z"
}
```

---

### 4.2 GET /recipients
Alle Empfänger abrufen.

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "firstName": "Erika",
      "lastName": "Mustermann",
      "city": "Berlin",
      "postalCode": "12345"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

---

### 4.3 GET /recipients/:id
Einzelnen Empfänger abrufen.

**Response** (200 OK):
```json
{
  "id": "uuid",
  "firstName": "Erika",
  "lastName": "Mustermann",
  "company": "Musterfirma GmbH",
  "street": "Musterstraße",
  "houseNumber": "42",
  "postalCode": "12345",
  "city": "Berlin",
  "country": "DE",
  "isVerified": true,
  "createdAt": "2024-01-20T10:45:00Z"
}
```

---

### 4.4 PATCH /recipients/:id
Empfänger aktualisieren.

**Request**:
```json
{
  "street": "Neue Straße",
  "houseNumber": "99"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "street": "Neue Straße",
  "houseNumber": "99",
  "updatedAt": "2024-01-20T11:00:00Z"
}
```

---

### 4.5 DELETE /recipients/:id
Empfänger löschen.

**Response** (200 OK):
```json
{
  "message": "Empfänger wurde gelöscht"
}
```

---

## 5. Mailings

### 5.1 POST /mailings
Neuen Versand erstellen.

**Request**:
```json
{
  "documentId": "uuid",
  "recipientId": "uuid",
  "mailingType": "standard",
  "colorMode": "bw",
  "doubleSided": true
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "documentId": "uuid",
  "recipientId": "uuid",
  "mailingType": "standard",
  "status": {
    "code": "pending",
    "name": "Wartend"
  },
  "costEstimate": 0.85,
  "currency": "EUR",
  "createdAt": "2024-01-20T11:05:00Z"
}
```

---

### 5.2 POST /mailings/bulk
Massenversand erstellen.

**Request**:
```json
{
  "documentId": "uuid",
  "recipients": [
    {
      "recipientId": "uuid-1"
    },
    {
      "recipientId": "uuid-2"
    }
  ],
  "mailingType": "standard",
  "colorMode": "bw"
}
```

**Response** (201 Created):
```json
{
  "batchId": "uuid",
  "totalCount": 2,
  "mailings": [
    {
      "id": "uuid-1",
      "recipientId": "uuid-1",
      "status": "pending"
    },
    {
      "id": "uuid-2",
      "recipientId": "uuid-2",
      "status": "pending"
    }
  ]
}
```

---

### 5.3 POST /mailings/:id/send
Versand auslösen.

**Response** (200 OK):
```json
{
  "id": "uuid",
  "status": {
    "code": "processing",
    "name": "In Verarbeitung"
  },
  "sentAt": "2024-01-20T11:10:00Z"
}
```

**Errors**:
- `400`: Keine Zugangsdaten hinterlegt
- `402`: Unzureichendes Guthaben
- `503`: Deutsche Post Service nicht erreichbar

---

### 5.4 GET /mailings
Alle Versandaufträge abrufen.

**Query Parameters**:
- `page`, `limit`
- `status`: Filter nach Status-Code
- `dateFrom`, `dateTo`: Zeitraum

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "document": {
        "id": "uuid",
        "fileName": "invoice.pdf"
      },
      "recipient": {
        "id": "uuid",
        "name": "Erika Mustermann"
      },
      "status": {
        "code": "delivered",
        "name": "Zugestellt"
      },
      "trackingNumber": "DE123456789",
      "costActual": 0.85,
      "sentAt": "2024-01-20T11:10:00Z",
      "deliveredAt": "2024-01-22T09:30:00Z"
    }
  ],
  "meta": {
    "total": 128,
    "page": 1,
    "limit": 20
  }
}
```

---

### 5.5 GET /mailings/:id
Einzelnen Versand abrufen.

**Response** (200 OK):
```json
{
  "id": "uuid",
  "documentId": "uuid",
  "document": {
    "fileName": "invoice.pdf",
    "pageCount": 3
  },
  "recipient": {
    "firstName": "Erika",
    "lastName": "Mustermann",
    "street": "Musterstraße 42",
    "postalCode": "12345",
    "city": "Berlin"
  },
  "mailingType": "standard",
  "status": {
    "code": "delivered",
    "name": "Zugestellt"
  },
  "trackingNumber": "DE123456789",
  "externalId": "DP-2024-001",
  "costEstimate": 0.85,
  "costActual": 0.85,
  "currency": "EUR",
  "sentAt": "2024-01-20T11:10:00Z",
  "deliveredAt": "2024-01-22T09:30:00Z",
  "createdAt": "2024-01-20T11:05:00Z"
}
```

---

### 5.6 GET /mailings/:id/tracking
Tracking-Informationen abrufen.

**Response** (200 OK):
```json
{
  "mailingId": "uuid",
  "trackingNumber": "DE123456789",
  "currentStatus": {
    "code": "in_transit",
    "name": "Versandt",
    "timestamp": "2024-01-21T08:00:00Z"
  },
  "events": [
    {
      "status": "submitted",
      "message": "An Deutsche Post übermittelt",
      "timestamp": "2024-01-20T11:10:00Z"
    },
    {
      "status": "printed",
      "message": "Dokument gedruckt",
      "timestamp": "2024-01-20T15:30:00Z"
    },
    {
      "status": "in_transit",
      "message": "Im Versand",
      "timestamp": "2024-01-21T08:00:00Z"
    }
  ]
}
```

---

### 5.7 POST /mailings/:id/cancel
Versand abbrechen (falls noch möglich).

**Response** (200 OK):
```json
{
  "id": "uuid",
  "status": {
    "code": "cancelled",
    "name": "Abgebrochen"
  },
  "message": "Versand wurde erfolgreich abgebrochen"
}
```

**Errors**:
- `409`: Versand kann nicht mehr abgebrochen werden (bereits gedruckt/versendet)

---

## 6. API Keys (für externe Systeme)

### 6.1 POST /api-keys
API-Key erstellen.

**Request**:
```json
{
  "name": "ERP System Integration",
  "permissions": ["documents:write", "mailings:send"],
  "rateLimitPerMinute": 120,
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "name": "ERP System Integration",
  "apiKey": "mm_live_1234567890abcdefghijklmnopqrstuvwxyz", // Nur einmal angezeigt!
  "keyPrefix": "mm_live_",
  "permissions": ["documents:write", "mailings:send"],
  "rateLimitPerMinute": 120,
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**⚠️ Wichtig**: API-Key wird nur einmal angezeigt!

---

### 6.2 GET /api-keys
Alle API-Keys abrufen.

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "ERP System Integration",
      "keyPrefix": "mm_live_",
      "isActive": true,
      "lastUsedAt": "2024-01-20T10:30:00Z",
      "createdAt": "2024-01-15T14:20:00Z",
      "expiresAt": "2025-12-31T23:59:59Z"
    }
  ]
}
```

---

### 6.3 DELETE /api-keys/:id
API-Key löschen.

**Response** (200 OK):
```json
{
  "message": "API-Key wurde gelöscht"
}
```

---

## 7. Statistics & Reporting

### 7.1 GET /statistics/dashboard
Dashboard-Statistiken.

**Response** (200 OK):
```json
{
  "totalDocuments": 42,
  "totalMailings": 128,
  "mailingsByStatus": {
    "pending": 5,
    "processing": 2,
    "delivered": 115,
    "failed": 6
  },
  "totalCost": 108.80,
  "currency": "EUR",
  "period": {
    "from": "2024-01-01T00:00:00Z",
    "to": "2024-01-31T23:59:59Z"
  }
}
```

---

### 7.2 GET /statistics/mailings
Versand-Statistiken (erweitert).

**Query Parameters**:
- `dateFrom`, `dateTo`
- `groupBy`: day, week, month

**Response** (200 OK):
```json
{
  "data": [
    {
      "date": "2024-01-20",
      "count": 12,
      "cost": 10.20,
      "successRate": 0.92
    }
  ],
  "summary": {
    "totalCount": 128,
    "totalCost": 108.80,
    "averageCost": 0.85,
    "successRate": 0.90
  }
}
```

---

## 8. Admin Endpoints (Role: admin)

### 8.1 GET /admin/users
Alle Benutzer verwalten.

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "isActive": true,
      "roles": ["user"],
      "totalDocuments": 42,
      "totalMailings": 128,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### 8.2 GET /admin/audit-logs
Audit-Logs abrufen.

**Query Parameters**:
- `userId`, `action`, `dateFrom`, `dateTo`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "action": "mailing.send",
      "entityType": "mailing",
      "entityId": "uuid",
      "ipAddress": "192.168.1.1",
      "status": "success",
      "createdAt": "2024-01-20T11:10:00Z"
    }
  ]
}
```

---

## Error Responses

Alle Fehler folgen diesem Format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Ungültige Eingabedaten",
    "details": [
      {
        "field": "email",
        "message": "E-Mail-Adresse ist ungültig"
      }
    ],
    "timestamp": "2024-01-20T11:10:00Z",
    "requestId": "uuid"
  }
}
```

### Standard HTTP Codes:
- `200`: OK
- `201`: Created
- `204`: No Content
- `400`: Bad Request (Validierungsfehler)
- `401`: Unauthorized (nicht authentifiziert)
- `403`: Forbidden (keine Berechtigung)
- `404`: Not Found
- `409`: Conflict (z.B. Duplikat)
- `413`: Payload Too Large
- `422`: Unprocessable Entity
- `429`: Too Many Requests (Rate Limit)
- `500`: Internal Server Error
- `503`: Service Unavailable

---

## Rate Limiting

### Limits pro Benutzer:
- **Standard User**: 60 Requests / Minute
- **API Key**: Konfigurierbar (Default: 120/Min)

### Headers:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642684800
```

### Exceeded Response (429):
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
    "retryAfter": 42
  }
}
```

---

## Webhooks (Optional, zukünftig)

### Registrierung:
```json
POST /webhooks
{
  "url": "https://customer.com/webhook",
  "events": ["mailing.delivered", "mailing.failed"],
  "secret": "webhook_secret_key"
}
```

### Event Payload:
```json
{
  "event": "mailing.delivered",
  "data": {
    "mailingId": "uuid",
    "trackingNumber": "DE123456789",
    "deliveredAt": "2024-01-22T09:30:00Z"
  },
  "timestamp": "2024-01-22T09:30:05Z"
}
```

---

## Versionierung

- **URL-basiert**: `/v1/`, `/v2/`
- **Breaking Changes** nur in neuer Version
- **Deprecation**: 6 Monate Vorankündigung

---

## OpenAPI/Swagger

Interaktive API-Dokumentation verfügbar unter:
```
https://api.merkurmail.de/docs
```

---

## Next Steps
1. OpenAPI 3.0 Schema generieren
2. Postman Collection erstellen
3. SDK für gängige Sprachen (TypeScript, Python, PHP)
4. Beispiel-Integrationen dokumentieren
