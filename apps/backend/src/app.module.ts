import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 60, // 60 requests per minute
      },
    ]),

    // Feature Modules (will be added later)
    // AuthModule,
    // UsersModule,
    // DocumentsModule,
    // MailingsModule,
    // AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
