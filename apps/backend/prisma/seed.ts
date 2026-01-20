import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create roles
  console.log('Creating roles...');
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator with full permissions',
      permissions: ['*'],
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Standard user',
      permissions: [
        'documents:read',
        'documents:write',
        'documents:delete',
        'mailings:read',
        'mailings:send',
      ],
    },
  });

  const readonlyRole = await prisma.role.upsert({
    where: { name: 'readonly' },
    update: {},
    create: {
      name: 'readonly',
      description: 'Read-only access',
      permissions: ['documents:read', 'mailings:read'],
    },
  });

  console.log('Roles created:', { adminRole, userRole, readonlyRole });

  // Create mailing statuses
  console.log('Creating mailing statuses...');
  const statuses = [
    {
      code: 'draft',
      name: 'Entwurf',
      description: 'Mailing noch nicht abgeschickt',
      isFinal: false,
      isError: false,
      sortOrder: 10,
    },
    {
      code: 'pending',
      name: 'Wartend',
      description: 'Warten auf Verarbeitung',
      isFinal: false,
      isError: false,
      sortOrder: 20,
    },
    {
      code: 'processing',
      name: 'In Verarbeitung',
      description: 'Wird an Deutsche Post übermittelt',
      isFinal: false,
      isError: false,
      sortOrder: 30,
    },
    {
      code: 'submitted',
      name: 'Übermittelt',
      description: 'Erfolgreich an Deutsche Post übermittelt',
      isFinal: false,
      isError: false,
      sortOrder: 40,
    },
    {
      code: 'printing',
      name: 'Wird gedruckt',
      description: 'Dokument wird gedruckt',
      isFinal: false,
      isError: false,
      sortOrder: 50,
    },
    {
      code: 'printed',
      name: 'Gedruckt',
      description: 'Dokument wurde gedruckt',
      isFinal: false,
      isError: false,
      sortOrder: 60,
    },
    {
      code: 'in_transit',
      name: 'Versandt',
      description: 'Im Versand',
      isFinal: false,
      isError: false,
      sortOrder: 70,
    },
    {
      code: 'delivered',
      name: 'Zugestellt',
      description: 'Erfolgreich zugestellt',
      isFinal: true,
      isError: false,
      sortOrder: 80,
    },
    {
      code: 'failed',
      name: 'Fehlgeschlagen',
      description: 'Versand fehlgeschlagen',
      isFinal: true,
      isError: true,
      sortOrder: 90,
    },
    {
      code: 'cancelled',
      name: 'Abgebrochen',
      description: 'Vom Benutzer abgebrochen',
      isFinal: true,
      isError: false,
      sortOrder: 100,
    },
  ];

  for (const status of statuses) {
    await prisma.mailingStatus.upsert({
      where: { code: status.code },
      update: {},
      create: status,
    });
  }

  console.log('Mailing statuses created');

  // Create system settings
  console.log('Creating system settings...');
  const settings = [
    {
      key: 'max_document_size_mb',
      value: 10,
      description: 'Maximale Dokumentengröße in MB',
      isPublic: true,
    },
    {
      key: 'max_pages_per_document',
      value: 50,
      description: 'Maximale Seitenzahl pro Dokument',
      isPublic: true,
    },
    {
      key: 'allowed_file_types',
      value: ['application/pdf'],
      description: 'Erlaubte MIME-Types',
      isPublic: true,
    },
    {
      key: 'retention_period_days',
      value: 90,
      description: 'Aufbewahrungsfrist für Dokumente in Tagen',
      isPublic: false,
    },
    {
      key: 'deutsche_post_api_enabled',
      value: false,
      description: 'Deutsche Post API aktiviert',
      isPublic: false,
    },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('System settings created');

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
