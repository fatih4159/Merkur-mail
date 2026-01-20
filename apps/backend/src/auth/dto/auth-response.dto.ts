import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description: 'JWT access token',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description: 'JWT refresh token',
  })
  refreshToken: string;

  @ApiProperty({
    example: 900,
    description: 'Access token expiration time in seconds',
  })
  expiresIn: number;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    roles: string[];
  };
}
