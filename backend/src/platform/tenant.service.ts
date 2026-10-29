import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

const SEATS = [
  'direktor',
  'layihe',
  'smeta',
  'satinalma',
  'anbardar',
  'muhasib',
  'kadr',
  'huquq',
  'muhendis',
  'sahe',
] as const;

export type Seat = (typeof SEATS)[number];

const AREAS: Record<string, (Seat | '*')[]> = {
  cabinet: ['*'],
  org: ['direktor'],
  members: ['direktor'],
  subscription: ['direktor', 'muhasib'],
  files: ['direktor', 'smeta', 'layihe', 'muhendis'],
  calc: ['direktor', 'smeta', 'muhendis'],
  haul: ['direktor', 'smeta', 'muhendis', 'satinalma', 'layihe'],
  catalog: ['direktor', 'satinalma', 'smeta'],
  tender: ['direktor', 'layihe', 'smeta', 'huquq'],
  boq: ['direktor', 'smeta', 'layihe', 'muhasib'],
  inquiry: ['direktor', 'satinalma'],
  warehouse: ['direktor', 'anbardar', 'satinalma'],
  finance: ['direktor', 'muhasib'],
  people: ['direktor', 'kadr', 'layihe'],
  legal: ['direktor', 'huquq'],
  quality: ['direktor', 'muhendis', 'sahe', 'anbardar'],
  weather: ['direktor', 'sahe', 'layihe', 'muhendis'],
  orders: ['direktor', 'layihe', 'satinalma', 'smeta'],
};

export type TenantCtx = {
  accountId: string;
  email: string;
  name: string;
  accountRole: string;
  seat: string | null;
  orgId: string | null;
  kind: string | null;
};

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async load(user: AuthUser): Promise<TenantCtx> {
    const account = await this.prisma.account.findUnique({
      where: { email: user.email },
      include: { memberships: { include: { organization: true } } },
    });
    if (!account) throw new ForbiddenException('Hesab tapılmadı');
    const chosen =
      account.memberships.find((item) => item.organizationId === account.activeOrgId) ??
      (account.memberships.length === 1 ? account.memberships[0] : undefined);
    return {
      accountId: account.id,
      email: account.email,
      name: account.name,
      accountRole: account.role,
      seat: chosen?.seatRole ?? null,
      orgId: chosen?.organizationId ?? null,
      kind: chosen?.organization.kind ?? null,
    };
  }

  allow(ctx: TenantCtx, area: string) {
    if (!ctx.orgId) {
      throw new ForbiddenException('Əvvəlcə şirkət kabineti açılmalıdır');
    }
    const seats = AREAS[area] ?? ['direktor'];
    if (seats.includes('*') || ctx.seat === 'direktor' || seats.includes(ctx.seat as Seat)) return ctx;
    throw new ForbiddenException('Bu əməliyyat sizin səlahiyyətinizdə deyil');
  }

  requireOrg(ctx: TenantCtx) {
    if (!ctx.orgId) {
      throw new ForbiddenException('Əvvəlcə şirkət kabineti açılmalıdır');
    }
    return ctx.orgId;
  }

  admin(ctx: TenantCtx) {
    this.requireOrg(ctx);
    if (ctx.kind !== 'admin' || ctx.seat !== 'direktor') {
      throw new ForbiddenException(
        'Platforma paneli yalnız administrator kabinetinə açıqdır',
      );
    }
  }

  async audit(ctx: TenantCtx, action: string, detail: string) {
    await this.prisma.auditEntry.create({
      data: {
        organizationId:ctx.orgId,
        at: new Date().toISOString(),
        actor: ctx.name,
        role: ctx.seat ?? ctx.accountRole,
        action,
        detail: `${ctx.orgId ?? '-'} ${detail}`.slice(0, 500),
      },
    });
  }

  async own(ctx: TenantCtx, model: 'project' | 'tenderCase' | 'boqBook', id: string) {
    const orgId = this.requireOrg(ctx);
    const row = await (this.prisma[model] as {
      findFirst: (args: object) => Promise<{ id: string } | null>;
    }).findFirst({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('Qeyd tapılmadı');
    return row;
  }
}

export function isSeat(value: string): value is Seat {
  return (SEATS as readonly string[]).includes(value);
}
