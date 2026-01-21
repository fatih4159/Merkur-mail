import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('S3_BUCKET') || 'merkurmail-documents';

    this.s3Client = new S3Client({
      endpoint: this.configService.get('S3_ENDPOINT') || 'http://localhost:9000',
      region: this.configService.get('S3_REGION') || 'eu-central-1',
      credentials: {
        accessKeyId: this.configService.get('S3_ACCESS_KEY') || 'minioadmin',
        secretAccessKey: this.configService.get('S3_SECRET_KEY') || 'minioadmin',
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    documentId: string,
  ): Promise<{ path: string; hash: string }> {
    try {
      // Generate file hash
      const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

      // Generate S3 key
      const key = `documents/${userId}/${documentId}/${file.originalname}`;

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          userId,
          documentId,
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      return {
        path: key,
        hash,
      };
    } catch (error) {
      console.error('Failed to upload file to S3:', error);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  async getFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const chunks: Uint8Array[] = [];

      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Failed to get file from S3:', error);
      throw new InternalServerErrorException('Failed to retrieve file');
    }
  }

  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      throw new InternalServerErrorException('Failed to generate download URL');
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Failed to delete file from S3:', error);
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getFileSize(key: string): Promise<number> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      return response.ContentLength || 0;
    } catch (error) {
      console.error('Failed to get file size:', error);
      return 0;
    }
  }
}
