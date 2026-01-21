import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'PDF file to upload',
  })
  file: Express.Multer.File;

  @ApiProperty({
    example: 'Rechnung Januar 2024',
    description: 'Document description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: { category: 'invoice', month: 'january' },
    description: 'Additional metadata as JSON',
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
