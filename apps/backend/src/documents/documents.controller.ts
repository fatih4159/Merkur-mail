import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseIntPipe,
  Ip,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a new document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        description: {
          type: 'string',
        },
        metadata: {
          type: 'object',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 413, description: 'File too large' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
    @Body('description') description?: string,
    @Body('metadata') metadata?: string,
    @Ip() ipAddress?: string,
  ) {
    const parsedMetadata = metadata ? JSON.parse(metadata) : undefined;

    return this.documentsService.uploadDocument(
      file,
      user.id,
      description,
      parsedMetadata,
      ipAddress,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all documents' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Documents retrieved' })
  async findAll(
    @CurrentUser() user: any,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('status') status?: string,
  ) {
    return this.documentsService.findAll(
      user.id,
      page || 1,
      limit || 20,
      status,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get document statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats(@CurrentUser() user: any) {
    return this.documentsService.getDocumentStats(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiResponse({ status: 200, description: 'Document retrieved' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Ip() ipAddress?: string,
  ) {
    return this.documentsService.findOne(id, user.id, ipAddress);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get signed download URL for document' })
  @ApiResponse({
    status: 200,
    description: 'Download URL generated',
    schema: {
      properties: {
        downloadUrl: { type: 'string' },
        fileName: { type: 'string' },
        expiresIn: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDownloadUrl(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Ip() ipAddress?: string,
  ) {
    return this.documentsService.getDownloadUrl(id, user.id, ipAddress);
  }

  @Patch(':id/metadata')
  @ApiOperation({ summary: 'Update document metadata' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          example: { category: 'invoice', tags: ['important'] },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Metadata updated' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async updateMetadata(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('metadata') metadata: Record<string, any>,
  ) {
    return this.documentsService.updateMetadata(id, user.id, metadata);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete document used in mailings',
  })
  async deleteDocument(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Ip() ipAddress?: string,
  ) {
    return this.documentsService.deleteDocument(id, user.id, ipAddress);
  }
}
