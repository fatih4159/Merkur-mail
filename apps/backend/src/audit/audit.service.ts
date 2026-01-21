import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogData {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestData?: any;
  responseData?: any;
  status?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          requestData: data.requestData ? JSON.parse(JSON.stringify(data.requestData)) : null,
          responseData: data.responseData ? JSON.parse(JSON.stringify(data.responseData)) : null,
          status: data.status || 'success',
        },
      });
    } catch (error) {
      // Don't throw errors from audit logging to avoid breaking the main flow
      console.error('Failed to create audit log:', error);
    }
  }

  async logAuthentication(
    userId: string,
    action: 'login' | 'logout' | 'register' | 'refresh' | 'password_reset',
    status: 'success' | 'failed',
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: `auth.${action}.${status}`,
      ipAddress,
      userAgent,
      status,
    });
  }

  async logDataAccess(
    userId: string,
    action: 'read' | 'write' | 'delete',
    entityType: string,
    entityId: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: `data.${entityType}.${action}`,
      entityType,
      entityId,
      ipAddress,
      status: 'success',
    });
  }

  async logGDPRAction(
    userId: string,
    action: 'export' | 'deletion',
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: `gdpr.${action}`,
      ipAddress,
      status: 'success',
    });
  }

  async getAuditLogs(
    filters: {
      userId?: string;
      action?: string;
      entityType?: string;
      startDate?: Date;
      endDate?: Date;
    },
    page: number = 1,
    limit: number = 50,
  ) {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = { contains: filters.action };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}
