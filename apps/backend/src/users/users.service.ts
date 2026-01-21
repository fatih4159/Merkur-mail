import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove sensitive data
    const { passwordHash, twoFactorSecret, ...userWithoutSensitive } = user;

    return {
      ...userWithoutSensitive,
      roles: user.roles.map((ur) => ur.role.name),
    };
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; companyName?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    const { passwordHash, twoFactorSecret, ...userWithoutSensitive } = user;
    return userWithoutSensitive;
  }

  // GDPR: Export all user data
  async exportUserData(userId: string, ipAddress?: string) {
    await this.auditService.logGDPRAction(userId, 'export', ipAddress);

    const [user, documents, mailings, recipients, auditLogs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      }),
      this.prisma.document.findMany({
        where: { userId },
      }),
      this.prisma.mailing.findMany({
        where: { userId },
        include: {
          status: true,
        },
      }),
      this.prisma.recipient.findMany({
        where: { userId },
      }),
      this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1000, // Last 1000 audit logs
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, twoFactorSecret, ...userWithoutSensitive } = user;

    return {
      personal: {
        ...userWithoutSensitive,
        roles: user.roles.map((ur) => ur.role.name),
      },
      documents: documents.map(({ filePath, ...doc }) => doc), // Exclude file paths
      mailings,
      recipients,
      auditLogs: auditLogs.map(({ requestData, responseData, ...log }) => log), // Exclude sensitive data
      exportedAt: new Date().toISOString(),
      dataProtectionNotice: 'This export contains all personal data stored in accordance with GDPR Article 20.',
    };
  }

  // GDPR: Delete user and all associated data
  async deleteUser(userId: string, ipAddress?: string) {
    await this.auditService.logGDPRAction(userId, 'deletion', ipAddress);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete: Mark user as deleted
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email: `deleted_${userId}@deleted.local`,
        firstName: '[DELETED]',
        lastName: '[DELETED]',
        companyName: '[DELETED]',
        isActive: false,
      },
    });

    // Delete credentials
    await this.prisma.userCredential.deleteMany({
      where: { userId },
    });

    // Delete refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // Delete API keys
    await this.prisma.apiKey.deleteMany({
      where: { userId },
    });

    // Soft delete documents
    await this.prisma.document.updateMany({
      where: { userId },
      data: { deletedAt: new Date() },
    });

    // Note: Mailings and recipients are kept for legal/accounting reasons
    // but anonymized (recipient data is in recipientSnapshot)

    return {
      message: 'User account and associated data marked for deletion',
      deletedAt: new Date().toISOString(),
      notice:
        'Your data has been anonymized. Complete deletion will occur within 30 days in accordance with our data retention policy.',
    };
  }

  // Hard delete (for cron job after 30 days)
  async hardDeleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.deletedAt) {
      return;
    }

    const daysSinceDeletion = Math.floor(
      (Date.now() - user.deletedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceDeletion < 30) {
      return; // Not ready for hard delete yet
    }

    // Delete all associated data
    await Promise.all([
      this.prisma.document.deleteMany({ where: { userId } }),
      this.prisma.mailing.deleteMany({ where: { userId } }),
      this.prisma.recipient.deleteMany({ where: { userId } }),
      this.prisma.auditLog.deleteMany({ where: { userId } }),
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }

  async getAllUsers(page: number = 1, limit: number = 50) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          companyName: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          lastLoginAt: true,
          roles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return {
      data: users.map((user) => ({
        ...user,
        roles: user.roles.map((ur) => ur.role.name),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
