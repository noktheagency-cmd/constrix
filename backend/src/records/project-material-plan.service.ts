import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.service';
import { TenantService } from '../platform/tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializable } from '../prisma/serializable';
type PlanLine = {
  materialId: string;
  name: string;
  unit: string;
  qty: string;
  baseQty?: string;
  sourceKind: string;
  sourceRef: string;
  smetaLineId: string | null;
  sourceSnapshot: {
    smetaId: string;
    version: number;
    qty: string;
    name: string;
    unit: string;
    kind: string;
  } | null;
  coefficient: string;
};
const unit = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/kq/g, 'kg')
    .replace(/\s+/g, '');
@Injectable()
export class ProjectMaterialPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}
  private async ctx(u: AuthUser, write = false) {
    const c = await this.tenant.load(u);
    const seats = write
      ? ['direktor', 'layihe', 'smeta', 'muhendis']
      : [
          'direktor',
          'layihe',
          'smeta',
          'muhendis',
          'anbardar',
          'satinalma',
          'muhasib',
        ];
    if (!seats.includes(c.seat || ''))
      throw new ForbiddenException('Material planına giriş icazəsi yoxdur');
    return { ...c, org: this.tenant.requireOrg(c) };
  }
  private async project(tx: Prisma.TransactionClient, org: string, id: string) {
    const p = await tx.project.findFirst({
      where: { id, organizationId: org },
    });
    if (!p) throw new NotFoundException('Layihə tapılmadı');
    return p;
  }
  async projects(u: AuthUser) {
    const c = await this.ctx(u);
    return this.prisma.project.findMany({
      where: { organizationId: c.org },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
  async sources(u: AuthUser, projectId: string) {
    const c = await this.ctx(u);
    return serializable(this.prisma, async (tx) => {
      await this.project(tx, c.org, projectId);
      const [smetas, materials] = await Promise.all([
        tx.smeta.findMany({
          where: { organizationId: c.org, projectId },
          include: { lines: true },
          orderBy: { version: 'desc' },
        }),
        tx.material.findMany({
          where: { organizationId: c.org },
          select: { id: true, name: true, unit: true },
        }),
      ]);
      return {
        materials,
        smetas: smetas.map((s) => ({
          id: s.id,
          version: s.version,
          status: s.status,
          lines: s.lines.map((l) => ({
            id: l.id,
            name: l.name,
            unit: l.unit,
            qty: l.qty.toString(),
            kind: l.kind,
          })),
        })),
      };
    });
  }
  async create(u: AuthUser, projectId: string, body: Record<string, unknown>) {
    const c = await this.ctx(u, true),
      reference = String(body.reference || '').trim();
    if (
      !reference ||
      reference.length > 200 ||
      !Array.isArray(body.lines) ||
      !body.lines.length ||
      body.lines.length > 500
    )
      throw new BadRequestException(
        'Mənbə sənədi və 1–500 plan sətri tələb olunur',
      );
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${c.org + ':plan:' + projectId}))`;
      await this.project(tx, c.org, projectId);
      const lines: PlanLine[] = [];
      const duplicate = new Set<string>();
      for (const raw of body.lines as Record<string, unknown>[]) {
        if (!raw || typeof raw !== 'object')
          throw new BadRequestException('Plan sətri düzgün deyil');
        const materialId = String(raw.materialId || ''),
          sourceKind = String(raw.sourceKind || ''),
          sourceRef = String(raw.sourceRef || '').trim();
        if (
          !['smeta', 'qrp', 'engineer'].includes(sourceKind) ||
          !sourceRef ||
          sourceRef.length > 200
        )
          throw new BadRequestException(
            'Mənbə növü və sətir/sənəd istinadı tələb olunur',
          );
        const m = await tx.material.findFirst({
          where: { id: materialId, organizationId: c.org },
        });
        if (!m) throw new BadRequestException('Material bu şirkətə aid deyil');
        if (unit(String(raw.unit || '')) !== unit(m.unit))
          throw new BadRequestException(
            'Plan vahidi material kataloqu ilə uyğun olmalıdır; vahid çevrilməsi avtomatik edilmir',
          );
        let base: string = String(raw.qty || ''),
          snapshot: PlanLine['sourceSnapshot'] = null;
        const smetaLineId = raw.smetaLineId ? String(raw.smetaLineId) : null;
        const coefficient = String(raw.coefficient || '1');
        if (
          !/^\d{1,9}(\.\d{1,6})?$/.test(coefficient) ||
          !new Prisma.Decimal(coefficient).gt(0)
        )
          throw new BadRequestException('Sərfiyyat əmsalı müsbət olmalıdır');
        if (sourceKind === 'smeta' && !smetaLineId)
          throw new BadRequestException('Smeta sətrini seçin');
        if (smetaLineId) {
          if (sourceKind === 'qrp')
            throw new BadRequestException('QRP sətri ayrıca mənbədir');
          const row = await tx.smetaLine.findFirst({
            where: {
              id: smetaLineId,
              smeta: { organizationId: c.org, projectId },
            },
            include: { smeta: true },
          });
          if (!row)
            throw new BadRequestException('Smeta sətri bu layihəyə aid deyil');
          if (
            sourceKind === 'smeta' &&
            (row.kind !== 'material' ||
              unit(row.unit) !== unit(m.unit) ||
              coefficient !== '1')
          )
            throw new BadRequestException(
              'İş həcmindən material hesabı üçün mühəndis mənbəsi və əmsal seçin',
            );
          base = row.qty.toString();
          snapshot = {
            smetaId: row.smetaId,
            version: row.smeta.version,
            qty: row.qty.toString(),
            name: row.name,
            unit: row.unit,
            kind: row.kind,
          };
        }
        if (!/^\d{1,10}(\.\d{1,3})?$/.test(String(base)))
          throw new BadRequestException('Mənbə miqdarı düzgün deyil');
        const qty = new Prisma.Decimal(String(base))
          .mul(coefficient)
          .toDecimalPlaces(3);
        if (!qty.gt(0) || qty.gte('100000000000'))
          throw new BadRequestException(
            'Plan miqdarı müsbət və hədd daxilində olmalıdır',
          );
        const identity = [
          sourceKind,
          smetaLineId || sourceRef,
          materialId,
        ].join(':');
        if (duplicate.has(identity))
          throw new BadRequestException(
            'Eyni mənbə/material sətri təkrarlanır',
          );
        duplicate.add(identity);
        lines.push({
          materialId,
          name: m.name,
          unit: m.unit,
          qty: qty.toString(),
          baseQty: String(base),
          sourceKind,
          sourceRef,
          smetaLineId,
          sourceSnapshot: snapshot,
          coefficient,
        });
      }
      const prev = await tx.projectMaterialPlan.findFirst({
        where: { organizationId: c.org, projectId },
        orderBy: { version: 'desc' },
      });
      const doc = await tx.projectMaterialPlan.create({
        data: {
          organizationId: c.org,
          projectId,
          version: (prev?.version || 0) + 1,
          reference,
          lines: lines as unknown as Prisma.InputJsonValue,
          createdById: c.accountId,
          createdBy: u.name,
        },
      });
      await this.audit(tx, c.org, u, 'material-plan-submit', doc.id);
      return doc;
    });
  }
  private async stale(
    tx: Prisma.TransactionClient,
    org: string,
    projectId: string,
    lines: PlanLine[],
  ) {
    for (const l of lines) {
      const material = await tx.material.findFirst({
        where: { id: l.materialId, organizationId: org },
      });
      if (!material || unit(material.unit) !== unit(l.unit)) return true;
      if (!l.smetaLineId) continue;
      const latest = await tx.smeta.findFirst({
        where: { organizationId: org, projectId },
        orderBy: { version: 'desc' },
      });
      if (
        latest &&
        l.sourceSnapshot &&
        latest.version > l.sourceSnapshot.version
      )
        return true;
      const r = await tx.smetaLine.findFirst({
        where: { id: l.smetaLineId, smeta: { organizationId: org, projectId } },
        include: { smeta: true },
      });
      const now = r
        ? {
            smetaId: r.smetaId,
            version: r.smeta.version,
            qty: r.qty.toString(),
            name: r.name,
            unit: r.unit,
            kind: r.kind,
          }
        : null;
      if (
        !now ||
        !l.sourceSnapshot ||
        (Object.keys(now) as (keyof typeof now)[]).some(
          (k) => now[k] !== l.sourceSnapshot![k],
        )
      )
        return true;
    }
    return false;
  }
  async review(
    u: AuthUser,
    projectId: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    const c = await this.ctx(u, true);
    if (c.seat !== 'direktor')
      throw new ForbiddenException('Planı direktor təsdiqləyir');
    const decision = String(body.decision || ''),
      note = String(body.note || '').trim();
    if (
      !['approve', 'reject'].includes(decision) ||
      note.length < 3 ||
      note.length > 500
    )
      throw new BadRequestException('Qərar və səbəb tələb olunur');
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${c.org + ':plan:' + projectId}))`;
      const d = await tx.projectMaterialPlan.findFirst({
        where: { id, projectId, organizationId: c.org },
      });
      if (!d) throw new NotFoundException('Plan tapılmadı');
      const status = decision === 'approve' ? 'approved' : 'rejected';
      if (
        d.status === status &&
        d.reviewedById === c.accountId &&
        d.reviewNote === note
      )
        return d;
      if (d.status !== 'pending')
        throw new ConflictException('Plan artıq baxılıb');
      if (d.createdById === c.accountId)
        throw new ConflictException('Planı başqa direktor təsdiqləməlidir');
      if (decision === 'approve') {
        if (
          await this.stale(
            tx,
            c.org,
            projectId,
            d.lines as unknown as PlanLine[],
          )
        )
          throw new ConflictException(
            'Mənbə smeta dəyişib; yeni plan versiyası yaradın',
          );
        const newer = await tx.projectMaterialPlan.findFirst({
          where: {
            organizationId: c.org,
            projectId,
            status: 'approved',
            version: { gt: d.version },
          },
        });
        if (newer)
          throw new ConflictException('Daha yeni plan artıq təsdiqlənib');
        await tx.projectMaterialPlan.updateMany({
          where: { organizationId: c.org, projectId, status: 'approved' },
          data: { status: 'superseded' },
        });
      }
      const row = await tx.projectMaterialPlan.update({
        where: { id },
        data: {
          status,
          reviewedById: c.accountId,
          reviewedBy: u.name,
          reviewNote: note,
          reviewedAt: new Date(),
        },
      });
      await this.audit(tx, c.org, u, `material-plan-${decision}`, id);
      return row;
    });
  }
  async report(u: AuthUser, projectId: string) {
    const c = await this.ctx(u);
    return serializable(this.prisma, async (tx) => {
      await this.project(tx, c.org, projectId);
      const plans = await tx.projectMaterialPlan.findMany({
        where: { organizationId: c.org, projectId },
        orderBy: { version: 'desc' },
      });
      const plan = plans.find((p) => p.status === 'approved'),
        lines = (plan?.lines || []) as unknown as PlanLine[];
      const receipts = await tx.purchaseReceiptLine.findMany({
        where: {
          receipt: {
            organizationId: c.org,
            reversedAt: null,
            act: { organizationId: c.org, projectId },
          },
        },
        include: { purchaseLine: true, receipt: { select: { id: true } } },
      });
      const returns = await tx.supplierGoodsReturnLine.findMany({
        where: {
          goodsReturn: {
            organizationId: c.org,
            purchaseAct: { projectId, organizationId: c.org },
            status: {
              in: [
                'sent',
                'supplier_accepted',
                'finance_approved',
                'finance_rejected',
              ],
            },
          },
        },
      });
      const consumed = await tx.materialCustodyAction.findMany({
        where: {
          organizationId: c.org,
          status: 'approved',
          kind: 'consume',
          handover: { organizationId: c.org, projectId },
        },
        include: { handover: { select: { materialId: true } } },
      });
      const transfers = await tx.shipmentLine.findMany({
        where: {
          shipment: {
            organizationId: c.org,
            status: 'received',
            OR: [
              { fromLocation: { projectId } },
              { toLocation: { projectId } },
            ],
          },
        },
        include: {
          shipment: { include: { fromLocation: true, toLocation: true } },
        },
      });
      const materials = await tx.material.findMany({
        where: { organizationId: c.org },
        select: { id: true, name: true, unit: true },
      });
      const ids = new Set([
        ...lines.map((l) => l.materialId),
        ...receipts.flatMap((l) =>
          l.purchaseLine.materialId ? [l.purchaseLine.materialId] : [],
        ),
        ...returns.map((l) => l.materialId),
        ...transfers.map((l) => l.materialId),
        ...consumed.map((l) => l.handover.materialId),
      ]);
      const items = [...ids].map((materialId) => {
        const m = materials.find((m) => m.id === materialId);
        const sum = (xs: Prisma.Decimal[]) =>
          xs.reduce((n, v) => n.plus(v), new Prisma.Decimal(0));
        const planned = sum(
          lines
            .filter((l) => l.materialId === materialId)
            .map((l) => new Prisma.Decimal(l.qty)),
        );
        const accepted = sum(
          receipts
            .filter(
              (l) =>
                l.purchaseLine.materialId === materialId &&
                !!m &&
                unit(l.purchaseLine.unit) === unit(m.unit),
            )
            .map((l) => l.acceptedQty),
        );
        const returned = sum(
          returns.filter((l) => l.materialId === materialId).map((l) => l.qty),
        );
        const moved = sum(
          transfers
            .filter((l) => l.materialId === materialId)
            .map((l) =>
              l.qty.mul(
                (l.shipment.toLocation?.projectId === projectId ? 1 : 0) -
                  (l.shipment.fromLocation?.projectId === projectId ? 1 : 0),
              ),
            ),
        );
        const used = sum(
          consumed
            .filter((l) => l.handover.materialId === materialId)
            .map((l) => l.qty),
        );
        const supplied = accepted.minus(returned).plus(moved);
        return {
          materialId,
          name: m?.name || materialId,
          unit: m?.unit || '',
          planned: planned.toString(),
          accepted: accepted.toString(),
          returned: returned.toString(),
          transferNet: moved.toString(),
          supplied: supplied.toString(),
          remaining: Prisma.Decimal.max(0, planned.minus(supplied)).toString(),
          excess: Prisma.Decimal.max(0, supplied.minus(planned)).toString(),
          consumed: used.toString(),
          unplanned: !lines.some((l) => l.materialId === materialId),
        };
      });
      return {
        plan: plan || null,
        plans,
        sourceChanged: plan
          ? await this.stale(tx, c.org, projectId, lines)
          : false,
        items,
        unmatchedReceiptLines: receipts
          .filter((l) => {
            const m = materials.find((m) => m.id === l.purchaseLine.materialId);
            return !m || unit(l.purchaseLine.unit) !== unit(m.unit);
          })
          .map((l) => l.id),
        generatedAt: new Date().toISOString(),
      };
    });
  }
  private async audit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    u: AuthUser,
    action: string,
    id: string,
  ) {
    await tx.auditEntry.create({
      data: {
        organizationId,
        at: new Date().toISOString(),
        actor: u.name,
        role: u.role,
        action,
        detail: id,
      },
    });
  }
}
