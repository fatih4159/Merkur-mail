import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../audit.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, body } = request;
    const userAgent = request.get('user-agent') || '';

    // Skip audit logging for certain endpoints
    const skipRoutes = ['/health', '/api/docs'];
    if (skipRoutes.some((route) => url.includes(route))) {
      return next.handle();
    }

    const action = this.determineAction(method, url);

    return next.handle().pipe(
      tap({
        next: (response) => {
          // Log successful requests
          if (user) {
            this.auditService.log({
              userId: user.id,
              action,
              ipAddress: ip,
              userAgent,
              requestData: this.sanitizeData(body),
              responseData: this.sanitizeData(response),
              status: 'success',
            });
          }
        },
        error: (error) => {
          // Log failed requests
          if (user) {
            this.auditService.log({
              userId: user.id,
              action,
              ipAddress: ip,
              userAgent,
              requestData: this.sanitizeData(body),
              responseData: { error: error.message },
              status: 'error',
            });
          }
        },
      }),
    );
  }

  private determineAction(method: string, url: string): string {
    const path = url.split('?')[0].replace('/api/v1/', '');
    return `${method.toLowerCase()}.${path}`;
  }

  private sanitizeData(data: any): any {
    if (!data) return null;

    const sensitiveFields = [
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'accessToken',
      'secret',
      'apiKey',
    ];

    const sanitized = JSON.parse(JSON.stringify(data));

    const removeSensitiveFields = (obj: any) => {
      for (const key in obj) {
        if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          removeSensitiveFields(obj[key]);
        }
      }
    };

    removeSensitiveFields(sanitized);
    return sanitized;
  }
}
