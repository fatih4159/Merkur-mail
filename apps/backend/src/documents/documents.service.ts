import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import * as PDFDocument from 'pdf-parse';

@Injectable()
export class DocumentsService {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  private readonly MAX_PAGES = 50;
  private readonly ALLOWED_MIME_TYPES = ['application/pdf'];

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private auditService: AuditService,
  ) {}

  async uploadDocument(
    file: Express.Multer.File,
    userId: string,
    description?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
  ) {
    // Validate file
    this.validateFile(file);

    // Parse PDF to get page count
    let pageCount = 0;
    try {
      const pdfData = await PDFDocument(file.buffer);
      pageCount = pdfData.numpages;

      if (pageCount > this.MAX_PAGES) {
        throw new BadRequestException(
          `Document has too many pages. Maximum allowed: ${this.MAX_PAGES}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to parse PDF file');
    }

    // Create document record
    const document = await this.prisma.document.create({
      data: {
        userId,
        fileName: file.originalname,
        filePath: '', // Will be updated after S3 upload
        fileSize: BigInt(file.size),
        fileHash: '', // Will be updated after S3 upload
        mimeType: file.mimetype,
        pageCount,
        status: 'uploading',
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });

    try {
      // Upload to S3
      const { path, hash } = await this.storageService.uploadFile(
        file,
        userId,
        document.id,
      );

      // Update document with file path and hash
      const updatedDocument = await this.prisma.document.update({
        where: { id: document.id },
        data: {
          filePath: path,
          fileHash: hash,
          status: 'validated',
        },
      });

      // Log document upload
      await this.auditService.logDataAccess(
        userId,
        'write',
        'document',
        document.id,
        ipAddress,
      );

      const { filePath, fileHash, ...documentWithoutSensitive } = updatedDocument;

      return {
        ...documentWithoutSensitive,
        fileSize: Number(documentWithoutSensitive.fileSize),
      };
    } catch (error) {
      // Cleanup: Delete document record if upload failed
      await this.prisma.document.delete({ where: { id: document.id } });
      throw error;
    }
  }

  async findAll(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
  ) {
    const where: any = {
      userId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          pageCount: true,
          status: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data: documents.map((doc) => ({
        ...doc,
        fileSize: Number(doc.fileSize),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, ipAddress?: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Log document access
    await this.auditService.logDataAccess(
      userId,
      'read',
      'document',
      id,
      ipAddress,
    );

    const { filePath, fileHash, ...documentWithoutSensitive } = document;

    return {
      ...documentWithoutSensitive,
      fileSize: Number(documentWithoutSensitive.fileSize),
    };
  }

  async getDownloadUrl(id: string, userId: string, ipAddress?: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Generate signed download URL (valid for 1 hour)
    const downloadUrl = await this.storageService.getSignedDownloadUrl(
      document.filePath,
      3600,
    );

    // Log document download
    await this.auditService.logDataAccess(
      userId,
      'read',
      'document',
      id,
      ipAddress,
    );

    return {
      downloadUrl,
      fileName: document.fileName,
      expiresIn: 3600,
    };
  }

  async deleteDocument(id: string, userId: string, ipAddress?: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check if document is used in mailings
    const mailingCount = await this.prisma.mailing.count({
      where: { documentId: id },
    });

    if (mailingCount > 0) {
      throw new BadRequestException(
        'Cannot delete document that is used in mailings',
      );
    }

    // Soft delete document
    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Delete from S3 (async, don't wait)
    this.storageService.deleteFile(document.filePath).catch((error) => {
      console.error('Failed to delete file from S3:', error);
    });

    // Log document deletion
    await this.auditService.logDataAccess(
      userId,
      'delete',
      'document',
      id,
      ipAddress,
    );

    return {
      message: 'Document deleted successfully',
    };
  }

  async updateMetadata(
    id: string,
    userId: string,
    metadata: Record<string, any>,
  ) {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const updatedDocument = await this.prisma.document.update({
      where: { id },
      data: {
        metadata: JSON.parse(JSON.stringify(metadata)),
      },
    });

    const { filePath, fileHash, ...documentWithoutSensitive } = updatedDocument;

    return {
      ...documentWithoutSensitive,
      fileSize: Number(documentWithoutSensitive.fileSize),
    };
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024} MB`,
      );
    }

    // Check MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Check file extension
    const allowedExtensions = ['.pdf'];
    const extension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (!allowedExtensions.includes(extension)) {
      throw new BadRequestException(
        `File extension not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`,
      );
    }
  }

  async getDocumentStats(userId: string) {
    const [totalDocuments, totalSize, statusCounts] = await Promise.all([
      this.prisma.document.count({
        where: { userId, deletedAt: null },
      }),
      this.prisma.document.aggregate({
        where: { userId, deletedAt: null },
        _sum: { fileSize: true },
      }),
      this.prisma.document.groupBy({
        by: ['status'],
        where: { userId, deletedAt: null },
        _count: true,
      }),
    ]);

    return {
      totalDocuments,
      totalSize: Number(totalSize._sum.fileSize || 0),
      byStatus: statusCounts.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
