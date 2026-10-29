import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditService } from '../modules/audit/audit.service';

type AdminReq = {
  admin?: { sub: number; role?: string };
  method: string;
  route?: { path?: string };
  originalUrl?: string;
  ip?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
};

function sanitizeForAudit(body: unknown): unknown {
  if (body == null || typeof body !== 'object') return body;
  const copy = { ...(body as Record<string, unknown>) };
  for (const key of ['password', 'idToken', 'passwordHash', 'token']) {
    if (key in copy) copy[key] = '[redacted]';
  }
  for (const key of ['htmlContent', 'value', 'html']) {
    if (typeof copy[key] === 'string' && (copy[key] as string).length > 800) {
      copy[key] = `${(copy[key] as string).slice(0, 800)}…`;
    }
  }
  return copy;
}

function buildAction(req: AdminReq): string {
  const method = req.method.toLowerCase();
  const path = req.route?.path ?? req.originalUrl?.split('?')[0] ?? 'unknown';
  const normalized = path.replace(/^\/api\/v1/, '').replace(/^\//, '');
  return `admin.${method}.${normalized.replace(/\//g, '.')}`;
}

function resourceFromPath(path: string): { type: string | null; id: string | null } {
  const parts = path.replace(/^\/api\/v1\//, '').split('/').filter(Boolean);
  if (parts[0] !== 'admin' || parts.length < 2) return { type: null, id: null };
  const type = parts[1];
  const id = parts[2] && !parts[2].includes(':') ? parts[2] : (parts[2] ?? null);
  return { type, id: id ?? null };
}

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AdminReq>();
    const adminId = req.admin?.sub;
    if (!adminId) {
      return next.handle();
    }

    const path = req.route?.path ?? req.originalUrl ?? '';
    if (!path.includes('/admin/')) {
      return next.handle();
    }

    const write = (outcome: 'success' | 'error', errorMessage?: string) => {
      const routePath = req.route?.path ?? req.originalUrl?.split('?')[0] ?? '';
      const { type, id } = resourceFromPath(routePath);
      void this.audit.log({
        actorType: 'admin',
        actorId: adminId,
        action: buildAction(req),
        resourceType: type ?? undefined,
        resourceId: id ?? (req.params?.id != null ? String(req.params.id) : undefined),
        payload: {
          outcome,
          query: req.query ?? {},
          params: req.params ?? {},
          body: sanitizeForAudit(req.body),
          ...(errorMessage ? { error: errorMessage } : {}),
        },
        ip: req.ip,
      });
    };

    return next.handle().pipe(
      tap(() => write('success')),
      catchError((err: Error) => {
        write('error', err?.message ?? 'error');
        return throwError(() => err);
      }),
    );
  }
}
