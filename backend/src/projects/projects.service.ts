import { AuthUser } from '../auth/auth.service';
import { TenantDataService } from '../prisma/tenant-data.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { rethrowPrisma } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../platform/tenant.service';
import {
  CreateProjectDto,
  PhaseDto,
  ProjectNoteDto,
} from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { buildPhaseProcedures } from './phase-procedures';

const projectInclude = {
  phases: { orderBy: { sort: 'asc' as const } },
  notes: { orderBy: { date: 'desc' as const } },
} satisfies Prisma.ProjectInclude;

type ProjectRecord = Prisma.ProjectGetPayload<{
  include: typeof projectInclude;
}>;

export type ProjectResponse = {
  id: string;
  name: string;
  client: string;
  district: string;
  city: string;
  address: string;
  phase: string;
  progress: number;
  budget: number;
  spent: number;
  start: string;
  end: string;
  manager: string;
  crew: number;
  status: ProjectRecord['status'];
  type: string;
  floors: number;
  area: number;
  phases: { name: string; done: boolean; current: boolean }[];
  notes: { id: string; date: string; text: string }[];
  note: string | null;
  smetaId: string | null;
};

function toProject(project: ProjectRecord): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    client: project.clientName,
    district: project.district,
    city: project.city,
    address: project.address,
    phase: project.phase,
    progress: project.progress,
    budget: project.budget.toNumber(),
    spent: project.spent.toNumber(),
    start: project.start,
    end: project.end,
    manager: project.manager,
    crew: project.crew,
    status: project.status,
    type: project.type,
    floors: project.floors,
    area: project.area.toNumber(),
    phases: project.phases.map((phase) => ({
      name: phase.name,
      done: phase.done,
      current: phase.current,
    })),
    notes: project.notes.map((note) => ({
      id: note.id,
      date: note.date,
      text: note.text,
    })),
    note: project.note,
    smetaId: project.smetaId,
  };
}

function phaseCreate(phases: PhaseDto[]) {
  return phases.map((phase, sort) => ({
    name: phase.name,
    done: phase.done ?? false,
    current: phase.current ?? false,
    sort,
  }));
}

function noteCreate(notes: ProjectNoteDto[]) {
  return notes.map((note) => ({
    ...(note.id ? { id: note.id } : {}),
    date: note.date,
    text: note.text,
  }));
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService,private readonly scope:TenantDataService,private readonly tenant:TenantService) {}

  async assignments(projectId: string, user: AuthUser) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'members');
    const organizationId = this.tenant.requireOrg(ctx);
    await this.scope.requireOwned('project', projectId, organizationId);
    const rows = await this.prisma.projectAssignment.findMany({
      where: { organizationId, projectId },
      include: { account: { select: { name: true, email: true } } },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });
    const memberships = await this.prisma.organizationMember.findMany({ where: { organizationId, accountId: { in: rows.map((row) => row.accountId) } }, select: { accountId: true, seatRole: true } });
    const seats = new Map(memberships.map((row) => [row.accountId, row.seatRole]));
    return rows.map((row) => ({ accountId: row.accountId, name: row.account.name, email: row.account.email, seatRole: seats.get(row.accountId) || '', canSendTransfers: row.canSendTransfers, canReceiveTransfers: row.canReceiveTransfers, active: row.active, assignedBy: row.assignedBy, updatedAt: row.updatedAt }));
  }

  async assign(projectId: string, body: Record<string, unknown>, user: AuthUser) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'members');
    const organizationId = this.tenant.requireOrg(ctx);
    await this.scope.requireOwned('project', projectId, organizationId);
    const accountId = String(body.accountId || '');
    const canSendTransfers = body.canSendTransfers;
    const canReceiveTransfers = body.canReceiveTransfers;
    if (!accountId || typeof canSendTransfers !== 'boolean' || typeof canReceiveTransfers !== 'boolean' || (!canSendTransfers && !canReceiveTransfers)) throw new BadRequestException('Layihə üzvü və ən azı bir transfer səlahiyyəti seçilməlidir');
    const member = await this.prisma.organizationMember.findFirst({ where: { organizationId, accountId }, select: { id: true, seatRole: true } });
    if (!member) throw new NotFoundException('İstifadəçi bu şirkətin aktiv üzvü deyil');
    if (!['sahe', 'layihe'].includes(member.seatRole)) throw new BadRequestException('Layihə transfer səlahiyyəti yalnız sahə və layihə üzvlərinə verilə bilər');
    const row = await this.prisma.projectAssignment.upsert({
      where: { organizationId_accountId_projectId: { organizationId, accountId, projectId } },
      update: { canSendTransfers, canReceiveTransfers, active: true, assignedBy: ctx.accountId },
      create: { organizationId, accountId, projectId, canSendTransfers, canReceiveTransfers, assignedBy: ctx.accountId },
      include: { account: { select: { name: true, email: true } } },
    });
    await this.tenant.audit(ctx, 'Layihəyə transfer səlahiyyəti təyin edildi', JSON.stringify({ projectId, accountId, canSendTransfers, canReceiveTransfers }));
    const seat = await this.prisma.organizationMember.findFirst({ where: { organizationId, accountId }, select: { seatRole: true } });
    return { accountId: row.accountId, name: row.account.name, email: row.account.email, seatRole: seat?.seatRole || '', canSendTransfers: row.canSendTransfers, canReceiveTransfers: row.canReceiveTransfers, active: row.active, assignedBy: row.assignedBy, updatedAt: row.updatedAt };
  }

  async unassign(projectId: string, accountId: string, user: AuthUser) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'members');
    const organizationId = this.tenant.requireOrg(ctx);
    await this.scope.requireOwned('project', projectId, organizationId);
    const row = await this.prisma.projectAssignment.findFirst({ where: { organizationId, projectId, accountId, active: true } });
    if (!row) throw new NotFoundException('Aktiv layihə təyinatı tapılmadı');
    await this.prisma.projectAssignment.update({ where: { id: row.id }, data: { active: false } });
    await this.tenant.audit(ctx, 'Layihə transfer səlahiyyəti deaktiv edildi', JSON.stringify({ projectId, accountId }));
  }

  async findAll(user:AuthUser): Promise<ProjectResponse[]> {
    const projects = await this.prisma.project.findMany({
      where:{organizationId:await this.scope.allow(user,'projects')},
      include: projectInclude,
      orderBy: { name: 'asc' },
      take: 500,
    });
    return projects.map(toProject);
  }

  async procedures(id: string,user:AuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id,organizationId:await this.scope.allow(user,'projects') },
      include: { phases: { orderBy: { sort: 'asc' } } },
    });
    if (!project) throw new NotFoundException(`Project ${id} was not found`);
    const rows = buildPhaseProcedures({
      id: project.id,
      phase: project.phase,
      progress: project.progress,
      budget: project.budget.toNumber(),
      start: project.start,
      phases: project.phases.map((phase) => ({
        name: phase.name,
        done: phase.done,
        current: phase.current,
        sort: phase.sort,
      })),
    });
    try {
      await this.prisma.$transaction([
        this.prisma.phaseProcedure.deleteMany({ where: { projectId: id } }),
        this.prisma.phaseProcedure.createMany({ data: rows }),
      ]);
    } catch (error) {
      rethrowPrisma(error);
    }
    return rows.map((row) => ({
      id: row.id,
      phase: row.phase,
      name: row.name,
      detail: row.detail,
      unit: row.unit,
      qty: row.qty,
      doneQty: row.doneQty,
      doneOn: row.doneOn,
    }));
  }

  async findOne(id: string,user:AuthUser): Promise<ProjectResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id,organizationId:await this.scope.allow(user,'projects') },
      include: projectInclude,
    });
    if (!project) throw new NotFoundException(`Project ${id} was not found`);
    return toProject(project);
  }

  async create(dto: CreateProjectDto,user:AuthUser): Promise<ProjectResponse> {
    if(dto.smetaId)await this.scope.requireOwned("smeta",dto.smetaId,await this.scope.allow(user,'projects'));
    const client = await this.prisma.client.findFirst({
      where: { name: dto.client,organizationId:await this.scope.allow(user,'projects') },
    });
    try {
      const project = await this.prisma.project.create({
        data: {
          ...(dto.id ? { id: dto.id } : {}),
          organizationId:await this.scope.allow(user,'projects'),
          name: dto.name,
          clientName: dto.client,
          clientId: client?.id,
          district: dto.district,
          city: dto.city,
          address: dto.address,
          phase: dto.phase,
          progress: dto.progress,
          budget: dto.budget,
          spent: dto.spent,
          start: dto.start,
          end: dto.end,
          manager: dto.manager,
          crew: dto.crew,
          status: dto.status,
          type: dto.type,
          floors: dto.floors,
          area: dto.area,
          note: dto.note,
          smetaId: dto.smetaId,
          phases: { create: phaseCreate(dto.phases ?? []) },
          notes: { create: noteCreate(dto.notes ?? []) },
        },
        include: projectInclude,
      });
      return toProject(project);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async update(id: string, dto: UpdateProjectDto,user:AuthUser): Promise<ProjectResponse> {
    await this.findOne(id,user);
    if(dto.smetaId)await this.scope.requireOwned("smeta",dto.smetaId,await this.scope.allow(user,'projects'));
    const client =
      dto.client === undefined
        ? undefined
        : await this.prisma.client.findFirst({ where: { name: dto.client,organizationId:await this.scope.allow(user,'projects') } });

    try {
      const project = await this.prisma.$transaction(async (tx) => {
        if (dto.phases) {
          await tx.projectPhase.deleteMany({ where: { projectId: id } });
        }
        if (dto.notes) {
          await tx.projectNote.deleteMany({ where: { projectId: id } });
        }
        return tx.project.update({
          where: { id,organizationId:await this.scope.allow(user,'projects') },
          data: {
            name: dto.name,
            clientName: dto.client,
            clientId: client === undefined ? undefined : (client?.id ?? null),
            district: dto.district,
            city: dto.city,
            address: dto.address,
            phase: dto.phase,
            progress: dto.progress,
            budget: dto.budget,
            spent: dto.spent,
            start: dto.start,
            end: dto.end,
            manager: dto.manager,
            crew: dto.crew,
            status: dto.status,
            type: dto.type,
            floors: dto.floors,
            area: dto.area,
            note: dto.note,
            smetaId: dto.smetaId,
            phases: dto.phases
              ? { create: phaseCreate(dto.phases) }
              : undefined,
            notes: dto.notes ? { create: noteCreate(dto.notes) } : undefined,
          },
          include: projectInclude,
        });
      });
      return toProject(project);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async remove(id: string,user:AuthUser): Promise<void> {
    await this.findOne(id,user);
    await this.prisma.project.delete({ where: { id } });
  }
}
