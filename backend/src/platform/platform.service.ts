import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FitStatus, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {XlsxTemplate,forceRecalculation,worksheetPath,writeNumericCell,priceColumns,appendTechnicalAttributes} from './xlsx-template';
import {createHash} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  boqTotals,
  compareBids,
  confirmedYears,
  discountLive,
  fillTemplate,
  fifoIssue,
  greenPartner,
  guaranteeAmount,
  isStale,
  logisticsMath,
  num,
  orgCode,
  pickPrice,
  scanUpload,
  scheduleSlip,
  tenderAlerts,
  variance,
  weatherStops,
  weightedAverage,
  windowMath,
} from './engine';
import {
  certAlerts,
  scoreChecks,
  tenderLetter,
  type CompanyFacts,
} from './tender-brief';
import { TenantCtx, TenantService } from './tenant.service';
import { extractTender, reviewedBrief } from './tender-analysis';

const STAGES = [
  'yeni',
  'fayl',
  'olcu',
  'hesab',
  'qiymet',
  'teklif',
  'tesdiq',
  'istehsal',
  'yoxlama',
  'dasima',
  'montaj',
  'tehvil',
  'zemanet',
] as const;

const CHECKS = [
  'Şirkət qeydiyyat sənədləri',
  'VÖEN',
  'İcazələr',
  'Maliyyə hesabatları',
  'Oxşar müqavilələr',
  'İcra aktları',
  'Diplomlar',
  'Təcrübə sənədləri',
  'Texnika sənədləri',
  'Keyfiyyət və təhlükəsizlik',
  'Smeta və qiymət təklifi',
  'İş qrafiki',
];

function text(value: unknown, fallback = '') {
  return value == null ? fallback : String(value).trim();
}

function money(value: unknown) {
  const parsed = num(value);
  return parsed == null ? null : new Prisma.Decimal(parsed.toString());
}

function day(value: unknown) {
  if (value == null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function required(value: unknown, label: string) {
  const raw = text(value);
  if (!raw) throw new BadRequestException(`${label} yazılmalıdır`);
  return raw;
}

const FITS = new Set(['uygun', 'deyil', 'catismir', 'gozleyir', 'el']);
const APPROVALS = new Set(['gozleyir', 'tesdiq', 'geri']);

function tenderFields(body: Record<string, unknown>) {
  const bidMode = text(body.bidMode) === 'percent' ? 'percent' : 'fixed';
  return {
    number: text(body.number),
    link: text(body.link),
    buyer: text(body.buyer),
    subject: required(body.subject, 'Tenderin predmeti'),
    classCode: text(body.classCode),
    classText: text(body.classText),
    price: money(body.price),
    deadline: day(body.deadline),
    bidMode: bidMode as 'percent' | 'fixed',
    bidValue: money(body.bidValue),
    sme: body.sme === true,
    discount: money(body.discount),
    advance: money(body.advance),
    task: text(body.task),
    contractDraft: text(body.contractDraft),
    qualification: text(body.qualification),
    similar: text(body.similar),
    bondDays: num(body.bondDays) == null ? null : Math.round(num(body.bondDays) as number),
    performDays: num(body.performDays) == null ? null : Math.round(num(body.performDays) as number),
  };
}

function checkRows(body: Record<string, unknown>) {
  const rows = Array.isArray(body.checks) ? body.checks : CHECKS.map((name) => ({ name, fit: 'catismir' }));
  return rows.map((row) => {
    const item = row as Record<string, unknown>;
    const fit = text(item.fit);
    return { name: text(item.name) || 'Yoxlama', fit: (FITS.has(fit) ? fit : 'catismir') as FitStatus };
  });
}

function approvalRows(body: Record<string, unknown>) {
  const rows = Array.isArray(body.approvals) ? body.approvals : [];
  return rows.map((row) => {
    const item = row as Record<string, unknown>;
    const status = text(item.status);
    return {
      role: text(item.role) || 'Təsdiq',
      status: (APPROVALS.has(status) ? status : 'gozleyir') as 'gozleyir',
    };
  });
}

@Injectable()
export class PlatformService {
  private sourceAccess(ctx: TenantCtx, kind: string) {
    if(kind==='purchase'&&ctx.seat==='anbardar')throw new ForbiddenException('Alış mənbəsində qiymət və nağd ödəniş məlumatları var.');
    const area = { purchase: 'warehouse', nakopitel: 'boq', boq: 'boq' }[kind];
    if (!area) throw new BadRequestException('Mənbə növü düzgün deyil');
    this.tenant.allow(ctx, area);
  }

  async sourceBooks(ctx: TenantCtx, kind: string) {
    this.sourceAccess(ctx, kind);
    return this.prisma.sourceWorkbook.findMany({
      where: { organizationId: ctx.orgId as string, kind },
      select: { id: true, name: true, sha256: true, sheets: { orderBy: { sort: 'asc' }, select: { id: true, name: true, rowCount: true, cellCount: true } } },
    });
  }

  async sourceRows(ctx: TenantCtx, id: string, pageInput: string, query: string, sizeInput = '10') {
    const sheet = await this.prisma.sourceSheet.findFirst({ where: { id, workbook: { organizationId: ctx.orgId as string } }, include: { workbook: { select: { kind: true } } } });
    if (!sheet) throw new NotFoundException('Vərəq tapılmadı');
    this.sourceAccess(ctx, sheet.workbook.kind);
    const rows = sheet.rows as { number: number; cells: { column: string; value: string | number | null; formula?: string }[] }[];
    const needle = (query || '').trim().toLocaleLowerCase('az');
    const filtered = needle ? rows.filter(row => row.cells.some(cell => String(cell.value ?? cell.formula ?? '').toLocaleLowerCase('az').includes(needle))) : rows;
    const requestedSize = Number(sizeInput);
    const pageSize = [10, 15, 20, 25, 50, 100].includes(requestedSize) ? requestedSize : 10;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(pages, Math.max(1, Number.parseInt(pageInput, 10) || 1));
    return { columns: sheet.columns, rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pages };
  }

  async sourceOriginal(ctx: TenantCtx, id: string) {
    const book = await this.prisma.sourceWorkbook.findFirst({ where: { id, organizationId: ctx.orgId as string } });
    if (!book) throw new NotFoundException('Mənbə tapılmadı');
    this.sourceAccess(ctx, book.kind);
    return book;
  }
  async sourcePrices(ctx:TenantCtx,id:string,boqId:string,options:Record<string,unknown>={}){
    const source=await this.sourceOriginal(ctx,id);if(source.kind!=='boq')throw new BadRequestException('Bu ixrac BOQ qiymət şablonu üçündür');
    const columns=priceColumns(options.columns),attributes=new Map<string,{row:number;brand:string;model:string;manufacturer:string;origin:string}[]>(),exportedRows=new Set<string>();
    const book=await this.prisma.boqBook.findFirst({where:{id:boqId,organizationId:ctx.orgId!},include:{lines:{orderBy:{sort:'asc'}}}});if(!book)throw new NotFoundException('BOQ tapılmadı');
    const lines=book.lines.filter(l=>l.confirmed&&!l.stale);if(!lines.length)throw new BadRequestException('İxrac üçün təsdiqli aktual qiymət yoxdur');
    const sheets=await this.prisma.sourceSheet.findMany({where:{workbookId:id}}),template=new XlsxTemplate(Buffer.from(source.original)),replacements=new Map<string,string>(),changes:unknown[]=[];
    for(const line of lines){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(line.pricedOn)||line.pricedOn>new Date().toISOString().slice(0,10))throw new BadRequestException('Təsdiqli qiymətin tarixi yoxlanmalıdır');
      const sheet=sheets.find(s=>s.name===line.sheet);if(!sheet)throw new BadRequestException(`${line.name}: orijinal vərəq tapılmadı`);
      const rows=sheet.rows as {number:number;cells:{column:string;value:unknown}[]}[];
      const matches=rows.filter(r=>{const val=(column:string)=>r.cells.find(c=>c.column===column)?.value;return (!line.sourceRow||r.number===line.sourceRow)&&String(val(columns.name)||'').trim()===line.name.trim()&&String(val(columns.unit)||'').trim()===line.unit.trim()&&Number(val(columns.qty))===line.qty.toNumber()});
      if(matches.length!==1)throw new BadRequestException(`${line.name}: mənbə sətri birmənalı uyğun gəlmir`);
      const row=matches[0].number,path=worksheetPath(template,line.sheet);let xml=replacements.get(path)||template.text(path);
      const rowKey=`${path}:${row}`;if(exportedRows.has(rowKey))throw new BadRequestException('Eyni mənbə sətrinə iki qiymət yazıla bilməz');exportedRows.add(rowKey);
      if(line.material.isNegative()||line.labor.isNegative())throw new BadRequestException('Mənfi qiymət ixrac edilmir');
      xml=writeNumericCell(xml,`${columns.material}${row}`,line.laborOnly?'0':line.material.toFixed(2));xml=writeNumericCell(xml,`${columns.labor}${row}`,line.labor.toFixed(2));replacements.set(path,xml);changes.push({lineId:line.id,sheet:line.sheet,row,material:line.material.toFixed(2),labor:line.labor.toFixed(2),pricedOn:line.pricedOn});
      if([line.brand,line.model,line.manufacturer,line.origin].some(Boolean)&&!line.attributeSource)throw new BadRequestException('Texniki atributların təsdiqləyən mənbəsi yoxdur');
      const list=attributes.get(path)||[];list.push({row,brand:line.brand,model:line.model,manufacturer:line.manufacturer,origin:line.origin});attributes.set(path,list);
    }
    if(options.includeAttributes===true){
      if(options.allowNewColumns!==true)throw new BadRequestException('Müştəri şablonuna atribut sütunları əlavə etmək üçün icazəni təsdiqləyin və ya atribut ixracını söndürün');
      for(const [path,rows]of attributes)replacements.set(path,appendTechnicalAttributes(replacements.get(path)!,rows,Number(options.headerRow)));
    }
    replacements.set('xl/workbook.xml',forceRecalculation(template.text('xl/workbook.xml')));const bytes=template.write(replacements),sha256=createHash('sha256').update(bytes).digest('hex');
    await this.tenant.audit(ctx,'Orijinal Excel şablonuna qiymət ixracı',JSON.stringify({sourceId:id,boqId,sourceSha256:source.sha256,sha256,rows:changes.length}));
    return {name:source.name.replace(/\.xlsx$/i,'-qiymet.xlsx'),bytes,rows:changes.length,sha256};
  }
  private readonly revealHits = new Map<string, { count: number; reset: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  async me(ctx: TenantCtx) {
    if (!ctx.orgId) return { org: null, seat: null };
    const org = await this.prisma.organization.findUnique({
      where: { id: ctx.orgId },
      include: { subscription: { include: { package: true } }, members: true },
    });
    const director = await this.ensureDirector(ctx.orgId);
    return { org, seat: ctx.seat, accountId:ctx.accountId,director: director ? { id: director.id, name: director.name } : null };
  }

  async listOrganizations(ctx: TenantCtx) {
    const account = await this.prisma.account.findUnique({
      where: { id: ctx.accountId },
      include: {
        memberships: { include: { organization: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!account) return { activeId: null, orgs: [] };
    const only = account.memberships.length === 1 ? account.memberships[0].organizationId : null;
    const active = account.memberships.some((item) => item.organizationId === account.activeOrgId)
      ? account.activeOrgId
      : only;
    if (active && active !== account.activeOrgId) {
      await this.prisma.account.update({
        where: { id: account.id },
        data: { activeOrgId: active },
      });
    }
    return {
      activeId: active,
      orgs: account.memberships.map((item) => {
        const { voen, bankDetails, ...rest } = item.organization;
        return {
          ...rest,
          seat: item.seatRole,
          hasVoen: Boolean(voen.trim()),
          hasBank: Boolean(bankDetails.trim()),
        };
      }),
    };
  }

  async revealSecrets(ctx: TenantCtx, body: Record<string, unknown>) {
    if (!ctx.orgId) throw new ForbiddenException('Şirkət seçilməyib');
    const password = text(body.password);
    this.assertReveal(ctx.accountId);
    const account = await this.prisma.account.findUnique({ where: { id: ctx.accountId } });
    const ok = Boolean(account?.passwordHash && password) && await bcrypt.compare(password, account?.passwordHash ?? '');
    if (!ok) {
      this.noteRevealFail(ctx.accountId);
      throw new BadRequestException('Şifrə yanlışdır.');
    }
    this.revealHits.delete(ctx.accountId);
    const org = await this.prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { voen: true, bankDetails: true },
    });
    return { voen: org?.voen ?? '', bankDetails: org?.bankDetails ?? '' };
  }

  private assertReveal(accountId: string) {
    const row = this.revealHits.get(accountId);
    if (row && row.reset >= Date.now() && row.count > 5) {
      throw new HttpException('Çox cəhd. Bir az sonra yenidən yoxlayın.', 429);
    }
  }

  private noteRevealFail(accountId: string) {
    const now = Date.now();
    const row = this.revealHits.get(accountId);
    if (!row || row.reset < now) {
      this.revealHits.set(accountId, { count: 1, reset: now + 15 * 60 * 1000 });
      return;
    }
    row.count += 1;
  }

  async selectOrganization(ctx: TenantCtx, body: Record<string, unknown>) {
    const id = text(body.id);
    if (!id) throw new BadRequestException('Şirkət seçilməlidir');
    const member = await this.prisma.organizationMember.findFirst({
      where: { accountId: ctx.accountId, organizationId: id },
    });
    if (!member) throw new ForbiddenException('Bu şirkət hesaba bağlı deyil');
    await this.prisma.account.update({
      where: { id: ctx.accountId },
      data: { activeOrgId: id },
    });
    return { id };
  }

  async register(ctx: TenantCtx, body: Record<string, unknown>) {
    const kind = required(body.kind, 'Fəaliyyət növü');
    const kinds = ['tikinti', 'memar', 'qapi', 'suse', 'pvc', 'fasad', 'dam', 'naves', 'hasar', 'material', 'montaj', 'logistika', 'admin'];
    if (!kinds.includes(kind)) throw new BadRequestException('Fəaliyyət növü seçilməlidir');
    if(kind==='admin')this.tenant.admin(ctx);
    const name = required(body.name, 'Şirkətin adı');
    const org = await this.prisma.organization.create({
      data: {
        kind: kind as Prisma.OrganizationCreateInput['kind'],
        name,
        code: orgCode(),
        voen: text(body.voen),
        phone: text(body.phone),
        email: text(body.email) || ctx.email,
        director: text(body.director) || ctx.name,
        legalAddress: text(body.legalAddress),
        actualAddress: text(body.actualAddress),
        capacity: text(body.capacity),
        warehouse: text(body.warehouse),
        regions: text(body.regions),
        warranty: text(body.warranty),
        staffCount: num(body.staffCount) == null ? null : Math.round(num(body.staffCount) as number),
        directions: text(body.directions),
        permits: text(body.permits),
        equipmentPark: text(body.equipmentPark),
        turnoverNote: text(body.turnoverNote),
        bankDetails: text(body.bankDetails),
        members: {
          create: {
            accountId: ctx.accountId,
            name: ctx.name,
            seatRole: 'direktor',
          },
        },
        warehousePolicy: { create: { method: 'orta' } },
      },
    });
    await this.prisma.account.update({
      where: { id: ctx.accountId },
      data: { activeOrgId: org.id },
    });
    await this.tenant.audit(
      { ...ctx, orgId: org.id, seat: 'direktor' },
      'kabinet',
      `Şirkət açıldı ${org.code}`,
    );
    await this.ensureDirector(org.id);
    return org;
  }

  async updateOrg(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'org');
    const kinds = ['tikinti', 'memar', 'qapi', 'suse', 'pvc', 'fasad', 'dam', 'naves', 'hasar', 'material', 'montaj', 'logistika', 'admin'];
    const kind = body.kind == null ? undefined : text(body.kind);
    if (kind != null && !kinds.includes(kind)) throw new BadRequestException('Fəaliyyət növü seçilməlidir');
    const saved = await this.prisma.organization.update({
      where: { id: ctx.orgId as string },
      data: {
        kind: kind as Prisma.OrganizationUpdateInput['kind'],
        name: text(body.name) || undefined,
        voen: body.voen == null ? undefined : text(body.voen),
        phone: body.phone == null ? undefined : text(body.phone),
        email: body.email == null ? undefined : text(body.email),
        director: body.director == null ? undefined : text(body.director),
        legalAddress: body.legalAddress == null ? undefined : text(body.legalAddress),
        actualAddress: body.actualAddress == null ? undefined : text(body.actualAddress),
        capacity: body.capacity == null ? undefined : text(body.capacity),
        warehouse: body.warehouse == null ? undefined : text(body.warehouse),
        regions: body.regions == null ? undefined : text(body.regions),
        warranty: body.warranty == null ? undefined : text(body.warranty),
        directions: body.directions == null ? undefined : text(body.directions),
        permits: body.permits == null ? undefined : text(body.permits),
        equipmentPark: body.equipmentPark == null ? undefined : text(body.equipmentPark),
        turnoverNote: body.turnoverNote == null ? undefined : text(body.turnoverNote),
        bankDetails: body.bankDetails == null ? undefined : text(body.bankDetails),
        staffCount: body.staffCount == null ? undefined : Math.round(num(body.staffCount) ?? 0),
      },
    });
    await this.ensureDirector(ctx.orgId as string);
    return saved;
  }

  async ensureDirector(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return null;
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId: orgId, seatRole: 'direktor' },
      include: { account: true },
      orderBy: { createdAt: 'asc' },
    });
    const name = org.director.trim() || member?.account?.name || member?.name || '';
    if (!name) return null;
    const matches = await this.prisma.person.findMany({ where: { name,organizationId:orgId } });
    const existing = matches.find((row) => row.id.startsWith('HR-')) ?? matches[0];
    if (existing) return existing;
    return this.prisma.person.create({
      data: {
        id: `dir-org-${orgId}`,
        organizationId:orgId,
        name,
        role: member?.account?.title || 'Direktor',
        crew: 'İdarəetmə',
        site: 'Baş ofis',
        placeKind: 'ofis',
        status: 'ofisde',
        phone: org.phone || '—',
        email: member?.account?.email || org.email || '—',
        departmentId: '',
        pin: '',
        hired: '',
        salary: 0,
        card: '',
      },
    });
  }

  async orgPeople(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'people');
    if (!ctx.orgId) return { directorId: '', people: [] };
    const director = await this.ensureDirector(ctx.orgId);
    const people = await this.prisma.person.findMany({ where:{organizationId:ctx.orgId},orderBy: { name: 'asc' } });
    return { directorId: director?.id ?? '', people: people.map((row) => this.staffRow(row)) };
  }

  async orgPerson(ctx: TenantCtx, id: string) {
    this.tenant.allow(ctx, 'people');
    if (!ctx.orgId) throw new NotFoundException('İşçi tapılmadı');
    await this.ensureDirector(ctx.orgId);
    const row = await this.prisma.person.findFirst({ where: { id,organizationId:ctx.orgId } });
    if (!row) throw new NotFoundException('İşçi tapılmadı');
    return this.staffRow(row);
  }

  private staffRow(row: {
    id: string;
    name: string;
    role: string;
    crew: string;
    site: string;
    placeKind: string;
    status: string;
    phone: string;
    email: string;
    departmentId: string;
    pin: string;
    hired: string;
    salary: Prisma.Decimal;
    card: string;
  }) {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      crew: row.crew,
      site: row.site,
      placeKind: row.placeKind,
      status: row.status,
      phone: row.phone,
      email: row.email,
      departmentId: row.departmentId,
      pin: row.pin,
      hired: row.hired,
      salary: Number(row.salary),
      card: row.card,
    };
  }

  async addMember(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'members');
    const seatRole = required(body.seatRole, 'Səlahiyyət');
    const sub = await this.prisma.orgSubscription.findUnique({
      where: { organizationId: ctx.orgId as string },
      include: { package: true },
    });
    if (sub?.package.userLimit != null) {
      const count = await this.prisma.organizationMember.count({
        where: { organizationId: ctx.orgId as string },
      });
      if (count >= sub.package.userLimit) {
        throw new ForbiddenException('Abunə paketinin istifadəçi həddi dolub');
      }
    }
    const email = text(body.email);
    const account = email
      ? await this.prisma.account.findUnique({ where: { email } })
      : null;
    if (account) {
      const taken = await this.prisma.organizationMember.findFirst({
        where: { accountId: account.id, organizationId: ctx.orgId as string },
      });
      if (taken) throw new BadRequestException('Bu hesab artıq bu kabinetdədir');
    }
    return this.prisma.organizationMember.create({
      data: {
        organizationId: ctx.orgId as string,
        accountId: account?.id,
        name: required(body.name, 'Ad'),
        seatRole,
      },
    });
  }

  packages() {
    return this.prisma.package.findMany({ orderBy: { tier: 'asc' } });
  }

  async editPackage(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.admin(ctx);
    const current = await this.prisma.package.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Paket tapılmadı');
    const limit = (value: unknown) => {
      const raw = text(value).trim();
      if (!raw) return null;
      const parsed = Math.round(num(value) ?? 0);
      return parsed > 0 ? parsed : null;
    };
    return this.prisma.package.update({
      where: { id },
      data: {
        amount: text(body.amount).trim() ? money(body.amount) : null,
        userLimit: limit(body.userLimit),
        smetaLimit: limit(body.smetaLimit),
      },
    });
  }

  async subscriptionState(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'cabinet');
    const sub = await this.prisma.orgSubscription.findUnique({
      where: { organizationId: ctx.orgId as string },
      include: { package: true },
    });
    const today = new Date();
    const ends = sub?.endsOn ?? null;
    const paid = sub?.status === 'aktiv' && (!ends || ends >= today);
    const daysLeft = ends ? Math.ceil((ends.getTime() - today.getTime()) / 86400000) : null;
    const warn = Boolean(sub && daysLeft != null && daysLeft <= 14 && daysLeft >= 0);
    if (warn && sub && !sub.warned) {
      await this.prisma.orgSubscription.update({ where: { id: sub.id }, data: { warned: true } });
      await this.prisma.notice.create({
        data: {
          organizationId: ctx.orgId as string,
          kind: 'abune',
          text: `Abunə ${daysLeft} günə bitir. Ödəniş sənəd kimi qeyd olunmalıdır.`,
          dueOn: ends,
        },
      });
    }
    const locked = paid ? [] : ['tender', 'techizat', 'maliyye', 'kadr'];
    return {
      status: paid ? 'aktiv' : (sub?.status ?? 'gozleyir'),
      startedOn: sub?.startedOn ?? null,
      endsOn: ends,
      daysLeft,
      warn,
      locked,
      channel: 'sened',
      package: sub?.package ?? null,
    };
  }

  async choosePackage(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'subscription');
    const packageId = required(body.packageId, 'Paket');
    const pack = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pack) throw new NotFoundException('Paket tapılmadı');
    const months = Math.max(1, Math.round(num(body.months) ?? 1));
    const started = new Date();
    const ends = addDays(started, months * 30);
    return this.prisma.orgSubscription.upsert({
      where: { organizationId: ctx.orgId as string },
      create: {
        organizationId: ctx.orgId as string,
        packageId,
        status: 'gozleyir',
        startedOn: started,
        endsOn: ends,
        warned: false,
      },
      update: { packageId, status: 'gozleyir', startedOn: started, endsOn: ends, warned: false },
    });
  }

  async notePayment(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'subscription');
    const current = await this.prisma.orgSubscription.findUnique({
      where: { organizationId: ctx.orgId as string },
    });
    if (!current) throw new BadRequestException('Əvvəlcə paket seçilməlidir');
    const months = Math.max(1, Math.round(num(body.months) ?? 1));
    const started = new Date();
    const ends = addDays(started, months * 30);
    const charge = await this.prisma.serviceCharge.create({
      data: {
        organizationId: ctx.orgId as string,
        planId: 'plan-abune',
        amount: money(body.amount),
        invoice: text(body.invoice) || 'əl ilə qeyd',
        status: 'qeyd',
      },
    });
    const subscription = await this.prisma.orgSubscription.update({
      where: { organizationId: ctx.orgId as string },
      data: { status: 'aktiv', startedOn: started, endsOn: ends, warned: false },
    });
    return { charge, subscription, channel: 'sened' };
  }

  async cabinet(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'cabinet');
    const orgId = ctx.orgId as string;
    const today = new Date();
    const [org, tenders, jobs, projects, talents, lots, flows, passports] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: orgId },
          include: { subscription: { include: { package: true } } },
        }),
        this.prisma.tenderCase.findMany({ where: { organizationId: orgId } }),
        this.prisma.calcJob.count({ where: { organizationId: orgId } }),
        this.prisma.project.findMany({ where: { organizationId: orgId } }),
        this.prisma.talent.count({ where: { organizationId: orgId } }),
        this.prisma.stockLot.findMany({ where: { organizationId: orgId } }),
        this.prisma.orderFlow.count({
          where: { organizationId: orgId, stage: { not: 'zemanet' } },
        }),
        this.prisma.materialPassport.findMany({ where: { organizationId: orgId } }),
      ]);
    const alerts = tenders.flatMap((tender) => tenderAlerts(tender.deadline, today));
    const expiring = passports.filter((row) => row.validUntil && isStale(row.validUntil, addDays(today, 30)) === false && row.validUntil < addDays(today, 30));
    const stockValue = lots.reduce((sum, lot) => sum + lot.qty.toNumber() * lot.unitCost.toNumber(), 0);
    return {
      code: org?.code,
      name: org?.name,
      kind: org?.kind,
      subscription: org?.subscription,
      activeTenders: tenders.length,
      estimates: jobs,
      projects: projects.length,
      contractValue: projects.reduce((sum, row) => sum + row.budget.toNumber(), 0),
      spent: projects.reduce((sum, row) => sum + row.spent.toNumber(), 0),
      openOrders: flows,
      stockValue,
      talents,
      expiringPassports: expiring.length,
      alerts,
    };
  }

  async saveProduct(ctx: TenantCtx, body: Record<string, unknown>, id?: string) {
    this.tenant.allow(ctx, 'catalog');
    const orgId = ctx.orgId as string;
    const price = money(body.price);
    if (!price) throw new BadRequestException('Satış qiyməti yazılmalıdır');
    if (id) {
      const current = await this.prisma.catalogProduct.findFirst({
        where: { id, organizationId: orgId },
      });
      if (!current) throw new NotFoundException('Məhsul tapılmadı');
      const next = await this.prisma.catalogProduct.update({
        where: { id },
        data: {
          name: required(body.name, 'Ad'),
          code: text(body.code),
          category: required(body.category, 'Kateqoriya'),
          params: text(body.params),
          colors: text(body.colors),
          sizes: text(body.sizes),
          unit: required(body.unit, 'Vahid'),
          price,
          cost: money(body.cost),
          validUntil: day(body.validUntil),
          minQty: money(body.minQty),
          leadDays: num(body.leadDays) == null ? null : Math.round(num(body.leadDays) as number),
          deliveryPrice: money(body.deliveryPrice),
          installPrice: money(body.installPrice),
        },
      });
      if (!current.price.equals(price)) {
        await this.prisma.priceChange.create({
          data: {
            productId: id,
            fromPrice: current.price,
            toPrice: price,
            byName: ctx.name,
          },
        });
      }
      return this.presentProduct(next, true);
    }
    const created = await this.prisma.catalogProduct.create({
      data: {
        organizationId: orgId,
        name: required(body.name, 'Ad'),
        code: text(body.code),
        category: required(body.category, 'Kateqoriya'),
        unit: required(body.unit, 'Vahid'),
        price,
        cost: money(body.cost),
        params: text(body.params),
        colors: text(body.colors),
        sizes: text(body.sizes),
        validUntil: day(body.validUntil),
        minQty: money(body.minQty),
        leadDays: num(body.leadDays) == null ? null : Math.round(num(body.leadDays) as number),
        deliveryPrice: money(body.deliveryPrice),
        installPrice: money(body.installPrice),
      },
    });
    return this.presentProduct(created, true);
  }

  async market(ctx: TenantCtx, category = '') {
    this.tenant.allow(ctx, 'cabinet');
    const rows = await this.prisma.catalogProduct.findMany({
      where: category ? { category } : {},
      include: { breaks: true, organization: { select: { id: true, name: true, regions: true } } },
    });
    const today = new Date();
    return rows.map((row) => {
      const own = row.organizationId === ctx.orgId;
      const stale = isStale(row.validUntil, today);
      return {
        id: row.id,
        name: row.name,
        code: row.code,
        category: row.category,
        unit: row.unit,
        price: stale ? null : row.price,
        stale,
        validUntil: row.validUntil,
        supplier: row.organization.name,
        regions: row.organization.regions,
        cost: own ? row.cost : null,
        current: !stale,
      };
    });
  }

  async quoteProduct(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'catalog');
    const product = await this.prisma.catalogProduct.findUnique({
      where: { id },
      include: { breaks: true },
    });
    if (!product) throw new NotFoundException('Məhsul tapılmadı');
    if (isStale(product.validUntil, new Date())) {
      throw new BadRequestException('Bu qiymətin qüvvədə olma müddəti bitib');
    }
    const own = product.organizationId === ctx.orgId;
    const price = pickPrice(
      product.price.toNumber(),
      product.breaks.map((row) => ({
        minQty: row.minQty.toNumber(),
        size: row.size,
        spec: row.spec,
        delivery: row.delivery,
        price: row.price.toNumber(),
      })),
      num(body.qty) ?? 1,
      text(body.size),
      text(body.spec),
      text(body.delivery),
    );
    return { price, cost: own ? product.cost : null, unit: product.unit, source: product.organizationId };
  }

  standards() {
    return this.prisma.standardMaterial.findMany({ orderBy: { category: 'asc' } });
  }

  async parseFile(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'files');
    const name = required(body.name, 'Fayl adı');
    const textBody = text(body.text);
    const scanned = scanUpload(name, textBody);
    if (scanned.scan === 'redd') throw new BadRequestException(scanned.note);
    const file = await this.prisma.projectFile.create({
      data: {
        organizationId: ctx.orgId as string,
        projectId: text(body.projectId) || null,
        name,
        ext: name.split('.').pop()?.toLowerCase() ?? '',
        size: textBody.length,
        scan: scanned.scan,
        scanNote: scanned.note,
        rows: {
          create: scanned.rows.map((row, sort) => ({
            sort,
            name: row.name || name,
            code: row.code,
            qty: row.qty,
            width: row.width,
            height: row.height,
            profile: row.profile,
            glass: row.glass,
            hardware: row.hardware,
            spec: row.spec,
            install: row.install,
            flags: row.flags,
            confirmed: false,
          })),
        },
      },
      include: { rows: true },
    });
    return file;
  }

  async confirmRow(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'files');
    const row = await this.prisma.extractedRow.findFirst({
      where: { id, file: { organizationId: ctx.orgId as string } },
    });
    if (!row) throw new NotFoundException('Sətir tapılmadı');
    return this.prisma.extractedRow.update({
      where: { id },
      data: {
        name: text(body.name) || row.name,
        qty: body.qty == null ? row.qty : text(body.qty),
        width: body.width == null ? row.width : text(body.width),
        height: body.height == null ? row.height : text(body.height),
        confirmed: body.confirmed === true,
      },
    });
  }

  previewCalc(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'calc');
    return this.mathFrom(body);
  }

  listJobs(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'calc');
    return this.prisma.calcJob.findMany({
      where: { organizationId: ctx.orgId as string },
      include: {
        lines: { orderBy: { sort: 'asc' } },
        products: {
          select: {
            productId: true,
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                unit: true,
                price: true,
                category: true,
                organization: { select: { name: true } },
              },
            },
          },
        },
        rule: {
          select: {
            id: true,
            system: true,
            confirmed: true,
            kgPerM: true,
            wastePercent: true,
            glassDeductMm: true,
            glassWastePercent: true,
          },
        },
        schedule: true,
        flow: { select: { stage: true, title: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveJob(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'calc');
    const math = await this.mathFrom(body);
    const wanted = Array.isArray(body.productIds)
      ? body.productIds.map((item) => text(item)).filter(Boolean)
      : [];
    const products = wanted.length
      ? await this.prisma.catalogProduct.findMany({
          where: { id: { in: wanted } },
          select: { id: true },
        })
      : [];
    const produce = Math.round(num(body.produceDays) ?? 0);
    const haul = Math.round(num(body.haulDays) ?? 0);
    const install = Math.round(num(body.installDays) ?? 0);
    const weather = Math.round(num(body.weatherDays) ?? 0);
    const total = produce + haul + install + weather;
    const start = day(body.startOn);
    const job = await this.prisma.calcJob.create({
      data: {
        organizationId: ctx.orgId as string,
        projectId: text(body.projectId) || null,
        ruleId: text(body.ruleId) || null,
        trade: (text(body.trade) || 'qapi') as Prisma.CalcJobCreateInput['trade'],
        title: required(body.title, 'Başlıq'),
        widthMm: money(body.width),
        heightMm: money(body.height),
        count: money(body.count),
        sections: Math.round(num(body.sections) ?? 1),
        opening: (text(body.opening) || 'doner') as Prisma.CalcJobCreateInput['opening'],
        color: text(body.color),
        profileNote: text(body.profileNote),
        glassKind: text(body.glassKind),
        glassThickness: text(body.glassThickness),
        hardware: text(body.hardware),
        installKind: text(body.installKind),
        address: text(body.address),
        profileUnit: text(body.profileUnit) || 'm',
        profileRate: money(body.profileRate),
        glassRate: money(body.glassRate),
        hardwareRate: money(body.hardwareRate),
        laborRate: money(body.laborRate),
        installRate: money(body.installRate),
        packRate: money(body.packRate),
        transport: money(body.transport),
        extra: money(body.extra),
        vatPercent: money(body.vat) ?? new Prisma.Decimal(18),
        profitPercent: money(body.profit) ?? new Prisma.Decimal(10),
        profitMode: (text(body.profitMode) || 'faiz') as Prisma.CalcJobCreateInput['profitMode'],
        glassConfirmed: body.glassConfirmed === true,
        lengthM: money(math.lengthM),
        weightKg: money(math.weightKg),
        wasteM: money(math.wasteM),
        glassArea: money(math.glassArea),
        cutArea: money(math.cutArea),
        cost: money(math.cost),
        profitAmount: money(math.profit),
        vatAmount: money(math.vat),
        sale: money(math.sale),
        gross: money(math.gross),
        blocked: math.blocked,
        lines: {
          create: math.lines.map((line, sort) => ({
            sort,
            name: line.name,
            unit: line.unit,
            qty: money(line.qty),
            rate: money(line.rate),
            amount: money(line.amount),
            note: line.note,
          })),
        },
        schedule: {
          create: {
            produceDays: produce,
            haulDays: haul,
            installDays: install,
            weatherDays: weather,
            totalDays: total,
            startOn: start,
            endOn: start ? addDays(start, total) : null,
          },
        },
        ...(products.length
          ? { products: { create: products.map((product) => ({ productId: product.id })) } }
          : {}),
      },
      include: { lines: true, schedule: true },
    });
    return { job, math };
  }

  listHauls(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'haul');
    return this.prisma.haulQuote.findMany({
      where: { organizationId: ctx.orgId as string },
      orderBy: { createdAt: 'desc' },
    });
  }

  previewHaul(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'haul');
    return logisticsMath({
      km: body.km,
      tariff: body.tariff,
      weight: body.weight,
      capacityKg: body.capacityKg,
      glassWidth: body.glassWidth,
      glassHeight: body.glassHeight,
      maxGlassMm: body.maxGlassMm,
      vehicle: text(body.vehicle) === 'suse' ? 'suse' : 'standart',
      roundTrip: body.roundTrip === true,
      loadCost: body.loadCost,
      waitCost: body.waitCost,
      extra: body.extra,
      speed: body.speed,
      days: body.days,
    });
  }

  async saveHaul(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'haul');
    const math = this.previewHaul(ctx, body);
    return this.prisma.haulQuote.create({
      data: {
        organizationId: ctx.orgId as string,
        fromPlace: text(body.fromPlace),
        toPlace: text(body.toPlace),
        km: money(math.km),
        weightKg: money(body.weight),
        volumeM3: money(body.volume),
        glassWidthMm: money(body.glassWidth),
        glassHeightMm: money(body.glassHeight),
        vehicle: text(body.vehicle) === 'suse' ? 'suse' : 'standart',
        capacityKg: money(body.capacityKg),
        maxGlassMm: money(body.maxGlassMm),
        roundTrip: body.roundTrip === true,
        loadCost: money(body.loadCost),
        waitCost: money(body.waitCost),
        extra: money(body.extra),
        tariffPerKm: money(body.tariff),
        speedKmDay: money(body.speed),
        days: math.days == null ? null : Math.round(math.days),
        fit: math.fit,
        cost: money(math.cost),
      },
    });
  }

  async listFlows(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'orders');
    const orgId = ctx.orgId as string;
    const where: Prisma.OrderFlowWhereInput =
      ctx.kind === 'admin'
        ? {}
        : {
            OR: [
              { organizationId: orgId },
              {
                supplierId: orgId,
                stage: { in: ['istehsal', 'yoxlama', 'dasima', 'montaj', 'tehvil', 'zemanet'] },
              },
              { carrierId: orgId, stage: { in: ['dasima', 'tehvil', 'zemanet'] } },
              { installerId: orgId, stage: { in: ['montaj', 'tehvil', 'zemanet'] } },
            ],
          };
    const [rows, partners] = await Promise.all([
      this.prisma.orderFlow.findMany({
        where,
        include: {
          events: { orderBy: { date: 'asc' } },
          supplier: { select: { id: true, name: true } },
          carrier: { select: { id: true, name: true } },
          installer: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.findMany({
        where: { kind: { in: ['qapi', 'suse', 'pvc', 'fasad', 'material', 'logistika', 'montaj'] } },
        select: { id: true, name: true, kind: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      partners,
      flows: rows.map((row) => ({
        id: row.id,
        title: row.title,
        stage: row.stage,
        mine: row.organizationId === orgId || ctx.kind === 'admin',
        createdAt: row.createdAt,
        supplier: row.supplier,
        carrier: row.carrier,
        installer: row.installer,
        project: row.project,
        events: row.events.map((event) => ({
          id: event.id,
          stage: event.stage,
          person: event.person,
          date: event.date,
          note: event.note,
          docs: event.docs,
        })),
      })),
    };
  }

  async openFlow(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'orders');
    const at = day(body.date) ?? new Date();
    return this.prisma.orderFlow.create({
      data: {
        organizationId: ctx.orgId as string,
        projectId: text(body.projectId) || null,
        jobId: text(body.jobId) || null,
        supplierId: text(body.supplierId) || null,
        carrierId: text(body.carrierId) || null,
        installerId: text(body.installerId) || null,
        title: text(body.title) || 'Sifariş',
        stage: 'yeni',
        events: {
          create: {
            stage: 'yeni',
            person: text(body.person) || ctx.name,
            date: at,
            note: text(body.note),
            docs: text(body.docs),
          },
        },
      },
      include: { events: true },
    });
  }

  async advanceFlow(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'orders');
    const person = required(body.person, 'Məsul şəxs');
    const at = day(body.date);
    if (!at) throw new BadRequestException('Tarix yazılmalıdır');
    const flow = await this.prisma.orderFlow.findFirst({
      where: { id, organizationId: ctx.orgId as string },
    });
    if (!flow) throw new NotFoundException('Sifariş tapılmadı');
    const index = STAGES.indexOf(flow.stage as (typeof STAGES)[number]);
    const next = STAGES[index + 1];
    if (!next) throw new BadRequestException('Sifariş son mərhələdədir');
    return this.prisma.orderFlow.update({
      where: { id },
      data: {
        stage: next,
        events: { create: { stage: next, person, date: at, note: text(body.note), docs: text(body.docs) } },
      },
      include: { events: true },
    });
  }

  async saveTender(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'tender');
    if(body.confirmed===true)throw new BadRequestException('Yeni tender əvvəl yoxlanmalıdır');
    if(text(body.projectId))await this.tenant.own(ctx,'project',text(body.projectId));
    const tender = await this.prisma.tenderCase.create({
      data: {
        organizationId: ctx.orgId as string,
        projectId: text(body.projectId) || null,
        ...tenderFields(body),
        checks: { create: checkRows(body) },
        approvals: { create: approvalRows(body).map(row=>({...row,status:'gozleyir'})) },
      },
      include: { checks: true, approvals: true },
    });
    return tender;
  }

  async listTenders(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'tender');
    return this.prisma.tenderCase.findMany({
      where: { organizationId: ctx.orgId as string },
      include: { checks: true, approvals: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateTender(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'tender');
    const current = await this.prisma.tenderCase.findFirst({
      where: { id, organizationId: ctx.orgId as string },
    });
    if (!current) throw new NotFoundException('Tender tapılmadı');
    const fields=tenderFields(body);
    const changed=Object.entries(fields).some(([key,value])=>JSON.stringify(value)!==JSON.stringify((current as unknown as Record<string,unknown>)[key]));
    return this.prisma.$transaction(async tx=>{
      const fresh=await tx.tenderCase.findUniqueOrThrow({where:{id},include:{approvals:true,checks:true}});
      if(fresh.contentVersion!==current.contentVersion)throw new BadRequestException('Tender paralel dəyişib. Yeniləyin.');
      const checks=checkRows(body);
      const ordered=(rows:{name:string;fit:string}[])=>[...rows].sort((a,b)=>a.name.localeCompare(b.name));
      const checksChanged=JSON.stringify(ordered(checks))!==JSON.stringify(ordered(fresh.checks.map(r=>({name:r.name,fit:r.fit}))));
      if(body.confirmed===true){
        const analysis=await tx.tenderAnalysis.findFirst({where:{tenderId:id},orderBy:{revision:'desc'}});
        if(changed||checksChanged||!analysis?.confirmedAt||!analysis.comparedAt||analysis.contentVersion!==fresh.contentVersion)throw new BadRequestException('Son sənəd versiyası yoxlanmalı və müqayisə edilməlidir');
        if(fresh.finalApproverId!==ctx.accountId)throw new ForbiddenException('Yekun təsdiq yalnız təyin edilmiş şəxsə aiddir');
        if(!checks.length||checks.some(r=>r.fit!=='uygun')||!fresh.approvals.length||fresh.approvals.some(r=>r.status!=='tesdiq'||!r.assignedAccountId||!r.signedBy))throw new BadRequestException('Məcburi sənədlər və təsdiq zənciri tamam deyil');
      }
      await tx.tenderCheck.deleteMany({where:{tenderId:id}});
      if(changed||checksChanged)await tx.tenderApproval.updateMany({where:{tenderId:id},data:{status:'gozleyir',signedAt:null,signedBy:null}});
      const updated=await tx.tenderCase.update({where:{id},data:{...fields,contentVersion:{increment:changed?1:0},opened:body.opened===true,confirmed:body.confirmed===true,checks:{create:checks}},include:{checks:true,approvals:true}});
      await tx.auditEntry.create({data:{organizationId:ctx.orgId,at:new Date().toISOString(),actor:ctx.name,role:ctx.seat||ctx.accountRole,action:body.confirmed===true?'Tender yekun təsdiqi':'Tender dəyişdirildi',detail:JSON.stringify({id,before:current,after:updated})}});
      return updated;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async tenderApprovalConfig(ctx:TenantCtx,id:string,body:Record<string,unknown>){
    this.tenant.allow(ctx,'org');await this.tenant.own(ctx,'tenderCase',id);
    const rows=Array.isArray(body.approvals)?body.approvals as {role:string;accountId:string}[]:[];
    const finalApproverId=String(body.finalApproverId||'');
    if(!rows.length||rows.length>30||rows.some(r=>!r.role?.trim()||!r.accountId)||!finalApproverId)throw new BadRequestException('Təsdiqçiləri və yekun təsdiqçini seçin');
    const ids=[...new Set([...rows.map(r=>r.accountId),finalApproverId])];
    const members=await this.prisma.organizationMember.count({where:{organizationId:ctx.orgId as string,accountId:{in:ids}}});
    if(members!==ids.length)throw new BadRequestException('Bütün təsdiqçilər şirkətin daxil olan istifadəçiləri olmalıdır');
    return this.prisma.$transaction(async tx=>{
      const previous=await tx.tenderApproval.findMany({where:{tenderId:id}});
      await tx.tenderApproval.deleteMany({where:{tenderId:id}});
      const result=await tx.tenderCase.update({where:{id},data:{finalApproverId,confirmed:false,approvals:{create:rows.map(row=>({role:row.role.slice(0,150),assignedAccountId:row.accountId,status:'gozleyir'}))}},include:{checks:true,approvals:true}});
      await tx.auditEntry.create({data:{organizationId:ctx.orgId,at:new Date().toISOString(),actor:ctx.name,role:ctx.seat||ctx.accountRole,action:'Tender təsdiqçiləri təyin edildi',detail:JSON.stringify({id,previous,approvals:rows,finalApproverId})}});
      return result;
    });
  }

  async tenderApprovalState(ctx:TenantCtx,id:string){
    this.tenant.requireOrg(ctx);
    const tender=await this.prisma.tenderCase.findFirst({where:{id,organizationId:ctx.orgId as string},include:{approvals:true,checks:true}});
    if(!tender)throw new NotFoundException('Tender tapılmadı');
    const assigned=tender.approvals.some(row=>row.assignedAccountId===ctx.accountId)||tender.finalApproverId===ctx.accountId;
    if(!assigned)this.tenant.allow(ctx,'tender');
    const decisions=await this.prisma.tenderDecision.findMany({where:{tenderId:id,organizationId:ctx.orgId as string},orderBy:{createdAt:'desc'}});
    return {tender,decisions,accountId:ctx.accountId};
  }

  async signTenderDocument(ctx:TenantCtx,id:string,approvalId:string,body:Record<string,unknown>){
    this.tenant.requireOrg(ctx);await this.tenant.own(ctx,'tenderCase',id);
    const status=body.status==='tesdiq'?'tesdiq':body.status==='geri'?'geri':null;
    if(!status)throw new BadRequestException('Qərar düzgün deyil');
    return this.prisma.$transaction(async tx=>{
      const tender=await tx.tenderCase.findUniqueOrThrow({where:{id}});
      const approval=await tx.tenderApproval.findFirst({where:{id:approvalId,tenderId:id}});
      if(!approval||approval.assignedAccountId!==ctx.accountId)throw new ForbiddenException('Bu sənədin təsdiqçisi siz deyilsiniz');
      const analysis=await tx.tenderAnalysis.findFirst({where:{tenderId:id},orderBy:{revision:'desc'}});
      if(!analysis?.confirmedAt||!analysis.comparedAt||analysis.contentVersion!==tender.contentVersion)throw new BadRequestException('Əvvəl son tələbləri yoxlayıb müqayisə edin');
      const note=String(body.note||'').trim().slice(0,4000);
      if(status==='geri'&&!note)throw new BadRequestException('Qaytarma səbəbini yazın');
      await tx.tenderApproval.update({where:{id:approvalId},data:{status,signedBy:ctx.accountId,signedAt:new Date(),note}});
      await tx.tenderDecision.create({data:{organizationId:ctx.orgId as string,tenderId:id,accountId:ctx.accountId,role:approval.role,status,note,contentVersion:tender.contentVersion}});
      await tx.tenderCase.update({where:{id},data:{confirmed:false}});
      return tx.tenderCase.findUnique({where:{id},include:{checks:true,approvals:true}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async recordTenderSubmission(ctx:TenantCtx,id:string,body:Record<string,unknown>){
    this.tenant.allow(ctx,'tender');
    const tender=await this.prisma.tenderCase.findFirst({where:{id,organizationId:ctx.orgId as string}});
    if(!tender)throw new NotFoundException('Tender tapılmadı');
    if(!tender.confirmed||tender.finalApproverId!==ctx.accountId)throw new ForbiddenException('Əvvəl yekun təsdiq tələb olunur');
    const proof=String(body.proof||'').trim();const date=new Date(String(body.submittedAt||''));
    if(!proof||!Number.isFinite(date.getTime()))throw new BadRequestException('Təqdimetmə tarixi və sübut qeydi vacibdir');
    return this.prisma.tenderCase.update({where:{id},data:{submittedAt:date,submissionProof:proof.slice(0,4000)}});
  }

  async refreshTender(ctx: TenantCtx, id: string) {
    this.tenant.allow(ctx, 'tender');
    const tender = await this.prisma.tenderCase.findFirst({
      where: { id, organizationId: ctx.orgId as string },
      include: { checks: true },
    });
    if (!tender) throw new NotFoundException('Tender tapılmadı');
    const reminder = await this.remind(ctx, tender);
    return { checks: tender.checks, ...reminder };
  }

  async readTender(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'tender');
    const tender = await this.prisma.tenderCase.findFirst({
      where: { id, organizationId: ctx.orgId as string },
    });
    if (!tender) throw new NotFoundException('Tender tapılmadı');
    const text = String(body.text ?? '');
    if (text.trim().length < 20) throw new BadRequestException('Oxunacaq mətn kifayət deyil.');
    const extracted = extractTender(text, String(body.sourceName || 'Daxil edilmiş tender mətni').slice(0, 240));
    const analysis = await this.prisma.$transaction(async tx => {
      const latest = await tx.tenderAnalysis.findFirst({where:{tenderId:id},orderBy:{revision:'desc'}});
      const created = await tx.tenderAnalysis.create({data:{tenderId:id,organizationId:ctx.orgId as string,contentVersion:tender.contentVersion,revision:(latest?.revision || 0)+1,sourceName:String(body.sourceName || 'Daxil edilmiş tender mətni').slice(0,240),sourceText:text,sourceHash:extracted.sourceHash,brief:extracted.brief as unknown as Prisma.InputJsonValue,evidence:extracted.evidence}});
      await tx.tenderCase.update({where:{id},data:{confirmed:false}});
      await tx.tenderApproval.updateMany({where:{tenderId:id},data:{status:'gozleyir',signedBy:null,signedAt:null}});
      return created;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return {analysis,brief:extracted.brief,evidence:extracted.evidence,needsReview:true,alerts:[],certs:[],letter:''};
  }

  async tenderAnalyses(ctx: TenantCtx, id: string) {
    this.tenant.allow(ctx,'tender');
    await this.tenant.own(ctx,'tenderCase',id);
    return this.prisma.tenderAnalysis.findMany({where:{tenderId:id,organizationId:ctx.orgId as string},orderBy:{revision:'desc'},select:{id:true,revision:true,sourceName:true,sourceHash:true,brief:true,evidence:true,confirmedAt:true,confirmedBy:true,comparedAt:true,createdAt:true}});
  }

  async reviewTenderAnalysis(ctx: TenantCtx, id: string, analysisId: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx,'tender');
    await this.tenant.own(ctx,'tenderCase',id);
    const brief=reviewedBrief(body.brief);
    return this.prisma.$transaction(async tx=>{
      const latest=await tx.tenderAnalysis.findFirst({where:{tenderId:id,organizationId:ctx.orgId as string},orderBy:{revision:'desc'}});
      if(!latest || latest.id!==analysisId) throw new BadRequestException('Mənbə yenilənib. Son versiyanı yoxlayın.');
      const tender=await tx.tenderCase.findUniqueOrThrow({where:{id}});
      if(latest.contentVersion!==tender.contentVersion)throw new BadRequestException('Tender şərtləri dəyişib. Mənbəni yenidən oxudun.');
      const result=await tx.tenderAnalysis.update({where:{id:analysisId},data:{brief:brief as unknown as Prisma.InputJsonValue,confirmedAt:new Date(),confirmedBy:ctx.accountId,comparedAt:null}});
      await tx.tenderCase.update({where:{id},data:{confirmed:false}});
      await tx.tenderApproval.updateMany({where:{tenderId:id},data:{status:'gozleyir',signedBy:null,signedAt:null}});
      return result;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async compareTenderAnalysis(ctx: TenantCtx, id: string, analysisId: string) {
    this.tenant.allow(ctx,'tender');
    const tender=await this.prisma.tenderCase.findFirst({where:{id,organizationId:ctx.orgId as string}});
    if(!tender)throw new NotFoundException('Tender tapılmadı');
    const analysis=await this.prisma.tenderAnalysis.findFirst({where:{tenderId:id,organizationId:ctx.orgId as string},orderBy:{revision:'desc'}});
    if(!analysis || analysis.id!==analysisId || !analysis.confirmedAt || analysis.contentVersion!==tender.contentVersion) throw new BadRequestException('Əvvəl son versiyanın tələblərini insan təsdiqləməlidir.');
    const brief=reviewedBrief(analysis.brief);
    const facts = await this.tenderFacts(ctx.orgId as string);
    const scored = scoreChecks(brief, facts);
    const checks=await this.prisma.$transaction(async tx=>{
      const latest=await tx.tenderAnalysis.findFirst({where:{tenderId:id},orderBy:{revision:'desc'}});
      if(latest?.id!==analysisId || !latest.confirmedAt || latest.confirmedAt.getTime()!==analysis.confirmedAt!.getTime())throw new BadRequestException('Tələblər dəyişib. Yenidən yoxlayın.');
      await tx.tenderCheck.deleteMany({where:{tenderId:id}});
      await tx.tenderCheck.createMany({data:scored.map(row=>({tenderId:id,name:row.name,fit:row.fit}))});
      await tx.tenderAnalysis.update({where:{id:analysisId},data:{comparedAt:new Date()}});
      return tx.tenderCheck.findMany({where:{tenderId:id}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    const staff = facts.people
      .filter((person) => /mühəndis|muhendis|usta|fəhlə|fehle/i.test(person.profession))
      .map((person) => ({
        name: person.name,
        profession: person.profession,
        years: person.years,
        confirmed: person.confirmed,
        fits: brief.engineerYears == null ? person.confirmed : person.confirmed && person.years + 0.001 >= brief.engineerYears,
      }));
    const gear = brief.gear.map((name) => {
      const hit = facts.gear.find((item) => item.name.toLocaleLowerCase('az').includes(name));
      return { required: name, asset: hit?.name ?? '', documented: hit?.documented ?? false };
    });
    const reminder = await this.remind(ctx, tender);
    return {
      brief,
      analysis:{...analysis,comparedAt:new Date()},
      checks: checks.map((item, index) => ({ name: item.name, fit: item.fit, why: scored[index]?.why ?? '' })),
      staff,
      gear,
      estimate: facts.estimate,
      ...reminder,
    };
  }

  private async tenderFacts(orgId: string): Promise<CompanyFacts & { people: { name: string; profession: string; years: number; confirmed: boolean }[]; estimate: { total: number | null; lines: number; note: string } }> {
    const [org, talents, assets, passports, books, schedules, bonds, files, templates] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: orgId } }),
      this.prisma.talent.findMany({ where: { organizationId: orgId }, include: { proofs: true } }),
      this.prisma.asset.findMany({where:{organizationId:orgId}}),
      this.prisma.materialPassport.findMany({ where: { organizationId: orgId } }),
      this.prisma.boqBook.findMany({ where: { organizationId: orgId }, include: { lines: true } }),
      this.prisma.workSchedule.findMany({ where: { organizationId: orgId }, include: { tasks: true } }),
      this.prisma.guaranteeCase.findMany({ where: { organizationId: orgId } }),
      this.prisma.projectFile.findMany({ where: { organizationId: orgId }, select: { name: true } }),
      this.prisma.legalTemplate.findMany({ where: { OR: [{ organizationId: orgId }, { organizationId: null }] }, select: { name: true, kind: true } }),
    ]);
    const people = talents.map((person) => ({
      name: person.name,
      profession: person.profession,
      years: confirmedYears(person.proofs.map((proof) => ({ years: proof.years == null ? null : Number(proof.years), confirmed: proof.confirmed }))),
      confirmed: person.proofs.some((proof) => proof.confirmed),
      diploma: person.proofs.some((proof) => proof.confirmed && proof.source === 'diplom'),
    }));
    const engineers = people.filter((person) => /mühəndis|muhendis/i.test(person.profession));
    const lines = books.flatMap((book) => book.lines);
    const total = lines.reduce((sum, line) => sum + Number(line.qty) * (Number(line.material) + Number(line.labor)), 0);
    const papers = [...files.map((file) => file.name), ...templates.map((item) => `${item.kind} ${item.name}`)].join(' ').toLocaleLowerCase('az');
    return {
      named: Boolean(org?.name.trim() && org.legalAddress.trim()),
      voen: (org?.voen.trim().length ?? 0) >= 10,
      permits: Boolean(org?.permits.trim()),
      turnover: Boolean(org?.turnoverNote.trim()),
      pastWork: Boolean(org?.capacity.trim()),
      hasAct: papers.includes('akt'),
      engineerDiploma: engineers.some((person) => person.diploma),
      engineerYears: engineers.reduce((max, person) => Math.max(max, person.years), 0),
      engineerConfirmed: engineers.some((person) => person.confirmed),
      workerYears: people.reduce((max, person) => Math.max(max, person.years), 0),
      workerConfirmed: people.some((person) => person.confirmed),
      gear: assets.map((item) => ({
        name: `${item.name} ${item.type}`,
        documented: Boolean(item.plate?.trim() || item.year),
      })),
      hasQuality: passports.length > 0,
      hasBoq: lines.length > 0,
      hasSchedule: schedules.some((item) => item.tasks.length > 0),
      hasBidBond: bonds.some((item) => item.kind === 'istirak'),
      hasPerformBond: bonds.some((item) => item.kind === 'icra'),
      people,
      estimate: {
        total: lines.length ? Math.round(total * 100) / 100 : null,
        lines: lines.length,
        note: lines.length
          ? `${lines.length} BOQ sətirinin material və işçilik cəmi.`
          : 'BOQ boşdur. Qiymət təklifi iş həcmi yazılandan sonra çıxır.',
      },
    };
  }

  private async remind(ctx: TenantCtx, tender: { number: string; subject: string; deadline: Date | null }) {
    const today = new Date();
    const alerts = tenderAlerts(tender.deadline, today);
    const passports = await this.prisma.materialPassport.findMany({
      where: { organizationId: ctx.orgId as string },
    });
    const certs = certAlerts(
      passports.map((row) => ({ material: row.material, certificate: row.certificate, validUntil: row.validUntil })),
      today,
    );
    const org = await this.prisma.organization.findUnique({ where: { id: ctx.orgId as string } });
    const lines = [...alerts, ...certs];
    const letter = lines.length
      ? tenderLetter({ to: org?.email || ctx.email, number: tender.number, subject: tender.subject, lines })
      : '';
    const notices: { kind: 'tender' | 'sertifikat' | 'sened'; text: string }[] = [
      ...alerts.map((text) => ({ kind: 'tender' as const, text })),
      ...certs.map((text) => ({ kind: 'sertifikat' as const, text })),
    ];
    if (letter) notices.push({ kind: 'sened', text: letter });
    for (const item of notices) {
      const exists = await this.prisma.notice.findFirst({
        where: { organizationId: ctx.orgId as string, text: item.text, read: false },
      });
      if (exists) continue;
      await this.prisma.notice.create({
        data: {
          organizationId: ctx.orgId as string,
          kind: item.kind,
          text: item.text,
          dueOn: tender.deadline,
        },
      });
    }
    return { alerts, certs, letter, portal: 'bagli' as const };
  }

  async saveBoq(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'boq');
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const costs = Array.isArray(body.costs) ? body.costs : [];
    const data = {
      projectId: text(body.projectId) || null,
      profit: money(body.profit) ?? new Prisma.Decimal(10),
      profitMode: (text(body.profitMode) === 'marja' ? 'marja' : 'faiz') as 'marja' | 'faiz',
      vat: money(body.vat) ?? new Prisma.Decimal(18),
      management: text(body.management),
      lines: {
        create: lines.map((line, sort) => {
          const row = line as Record<string, unknown>;
          if ([row.brand,row.model,row.manufacturer,row.origin].some(value=>text(value))&&!text(row.attributeSource)) throw new BadRequestException('Marka/model/istehsalçı/mənşə üçün təsdiqləyən mənbə yazın');
          return {
            sort,
            brand:text(row.brand),model:text(row.model),manufacturer:text(row.manufacturer),origin:text(row.origin),attributeSource:text(row.attributeSource),
            sheet: text(row.sheet) || 'Əsas',
            name: required(row.name, 'İş'),
            unit: text(row.unit) || 'eded',
            qty: money(row.qty) ?? new Prisma.Decimal(0),
            material: money(row.material) ?? new Prisma.Decimal(0),
            labor: money(row.labor) ?? new Prisma.Decimal(0),
            laborOnly: row.laborOnly === true,
            sourceRow: Number.isInteger(row.sourceRow)&&Number(row.sourceRow)>0?Number(row.sourceRow):null,
            confirmed: row.confirmed===true, source:text(row.source), pricedOn:text(row.pricedOn), stale:row.stale===true,
          };
        }),
      },
      costs: {
        create: costs.map((line, sort) => {
          const row = line as Record<string, unknown>;
          const kind = text(row.kind);
          return {
            sort,
            kind: (kind === 'overhead' || kind === 'extra' ? kind : 'indirect') as 'indirect' | 'overhead' | 'extra',
            name: text(row.name) || 'Xərc',
            amount: money(row.amount) ?? new Prisma.Decimal(0),
          };
        }),
      },
    };
    const existingId = text(body.id);
    if (existingId) {
      const current = await this.prisma.boqBook.findFirst({
        where: { id: existingId, organizationId: ctx.orgId as string },
      });
      if (!current) throw new NotFoundException('Smeta tapılmadı');
      return this.prisma.$transaction(async tx=>{await tx.boqLine.deleteMany({ where: { bookId: existingId } });
      await tx.boqCost.deleteMany({ where: { bookId: existingId } });
      const updated=await tx.boqBook.update({
        where: { id: existingId },
        data,
        include: { lines: true, costs: true, gear: true },
      });await tx.auditEntry.create({data:{organizationId:ctx.orgId,at:new Date().toISOString(),actor:ctx.name,role:ctx.seat||ctx.accountRole,action:'BOQ qiymət yoxlaması',detail:JSON.stringify({id:existingId,lines:updated.lines})}});return updated;});
    }
    await this.guardSmetaLimit(ctx.orgId as string);
    return this.prisma.boqBook.create({
      data: { organizationId: ctx.orgId as string, ...data },
      include: { lines: true, costs: true, gear: true },
    });
  }

  async listBoq(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'boq');
    return this.prisma.boqBook.findMany({
      where: { organizationId: ctx.orgId as string },
      include: { lines: { orderBy: { sort: 'asc' } }, costs: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async boqResult(ctx: TenantCtx, id: string) {
    this.tenant.allow(ctx, 'boq');
    const book = await this.prisma.boqBook.findFirst({
      where: { id, organizationId: ctx.orgId as string },
      include: { lines: true, costs: true, gear: true, staff: true },
    });
    if (!book) throw new NotFoundException('Smeta tapılmadı');
    const totals = boqTotals({
      lines: book.lines.map((line) => ({
        qty: line.qty.toNumber(),
        material: line.material.toNumber(),
        labor: line.labor.toNumber(),
      })),
      costs: book.costs.map((row) => ({ amount: row.amount.toNumber() })),
      gearInsurance: book.gear.reduce((sum, row) => sum + row.insurance.toNumber(), 0),
      profit: book.profit.toNumber(),
      profitMode: book.profitMode,
      vat: book.vat.toNumber(),
    });
    return {
      book,
      totals,
      staff: book.staff,
      needsConfirmation: true,
    };
  }

  async createInquiry(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'inquiry');
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!lines.length) throw new BadRequestException('Material sətri yazılmalıdır');
    return this.prisma.priceInquiry.create({
      data: {
        organizationId: ctx.orgId as string,
        supplierId: text(body.supplierId) || null,
        title: required(body.title, 'Sorğu'),
        lines: {
          create: lines.map((line) => {
            const row = line as Record<string, unknown>;
            return {
              name: required(row.name, 'Material'),
              unit: text(row.unit) || 'eded',
              qty: money(row.qty) ?? new Prisma.Decimal(1),
              spec: text(row.spec),
            };
          }),
        },
      },
      include: { lines: true },
    });
  }

  async incomingInquiries(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'inquiry');
    return this.prisma.priceInquiry.findMany({
      where: { supplierId: ctx.orgId as string },
      include: { lines: true, bids: {where:{organizationId:ctx.orgId as string}}, organization: { select: { name: true, code: true } } },
    });
  }

  async marketRfqs(ctx: TenantCtx) {
    const organizationId = this.tenant.requireOrg(ctx);
    return this.prisma.priceInquiry.findMany({
      where: { organizationId },
      include: {
        lines: true,
        supplier: { select: { name: true } },
        bids: { include: { organization: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async placeBid(ctx: TenantCtx, inquiryId: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'inquiry');
    const inquiry = await this.prisma.priceInquiry.findFirst({
      where: { id: inquiryId, supplierId: ctx.orgId as string },
    });
    if (!inquiry) throw new NotFoundException('Sorğu tapılmadı');
    const bid = await this.prisma.supplierBid.create({
      data: {
        inquiryId,
        organizationId: ctx.orgId as string,
        unitPrice: money(body.unitPrice),
        qty: money(body.qty),
        leadDays: num(body.leadDays) == null ? null : Math.round(num(body.leadDays) as number),
        delivery: money(body.delivery),
        payment: text(body.payment),
        validUntil: day(body.validUntil),
        quality: text(body.quality),
        status: 'verildi',
      },
    });
    await this.prisma.priceInquiry.update({
      where: { id: inquiryId },
      data: { status: 'cavablandi' },
    });
    return bid;
  }

  async compareInquiry(ctx: TenantCtx, id: string) {
    this.tenant.allow(ctx, 'inquiry');
    const inquiry = await this.prisma.priceInquiry.findFirst({
      where: { id, organizationId: ctx.orgId as string },
      include: { bids: true },
    });
    if (!inquiry) throw new NotFoundException('Sorğu tapılmadı');
    return compareBids(
      inquiry.bids.map((bid) => ({
        id: bid.id,
        unitPrice: bid.unitPrice?.toNumber() ?? null,
        leadDays: bid.leadDays,
        quality: bid.quality,
        delivery: bid.delivery?.toNumber() ?? null,
      })),
    );
  }

  async selectBid(ctx: TenantCtx, id: string) {
    this.tenant.allow(ctx, 'inquiry');
    const bid = await this.prisma.supplierBid.findFirst({
      where: { id, inquiry: { organizationId: ctx.orgId as string } },
    });
    if (!bid) throw new NotFoundException('Təklif tapılmadı');
    return this.prisma.supplierBid.update({ where: { id }, data: { status: 'secildi' } });
  }

  async receiveLot(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'warehouse');
    const qty = num(body.qty);
    const unitCost = num(body.unitCost);
    if (qty == null || qty <= 0 || unitCost == null) {
      throw new BadRequestException('Miqdar və maya yazılmalıdır');
    }
    const policy = await this.prisma.warehousePolicy.findUnique({
      where: { organizationId: ctx.orgId as string },
    });
    let cost = unitCost;
    if ((policy?.method ?? 'orta') === 'orta') {
      const lots = await this.prisma.stockLot.findMany({
        where: { organizationId: ctx.orgId as string, code: required(body.code, 'Material kodu') },
      });
      const average = weightedAverage(
        lots.map((lot) => ({ qty: lot.qty.toNumber(), unitCost: lot.unitCost.toNumber() })),
        qty,
        unitCost,
      );
      cost = average ?? unitCost;
    }
    return this.prisma.stockLot.create({
      data: {
        organizationId: ctx.orgId as string,
        materialId: text(body.materialId) || null,
        locationId: text(body.locationId) || null,
        code: required(body.code, 'Material kodu'),
        batch: text(body.batch),
        qty: new Prisma.Decimal(qty.toString()),
        unitCost: new Prisma.Decimal(cost.toString()),
        expiresOn: day(body.expiresOn),
        qr: `QR-${orgCode()}`,
      },
    });
  }

  async issueLot(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'warehouse');
    const qty = num(body.qty);
    if (qty == null) throw new BadRequestException('Miqdar yazılmalıdır');
    const policy = await this.prisma.warehousePolicy.findUnique({
      where: { organizationId: ctx.orgId as string },
    });
    const code = required(body.code, 'Material kodu');
    const lots = await this.prisma.stockLot.findMany({
      where: { organizationId: ctx.orgId as string, code },
      orderBy: { createdAt: 'asc' },
    });
    const have = lots.reduce((sum, lot) => sum + lot.qty.toNumber(), 0);
    if (have + 1e-9 < qty) throw new BadRequestException('Anbar qalığı sıfırdan aşağı düşə bilməz');
    const method = policy?.method ?? 'orta';
    let unitCost = 0;
    if (method === 'fifo') {
      const plan = fifoIssue(
        lots.map((lot) => ({ id: lot.id, qty: lot.qty.toNumber(), at: lot.createdAt.getTime() })),
        qty,
      );
      if (!plan.ok) throw new BadRequestException(plan.reason);
      let spent = 0;
      for (const take of plan.taken) {
        const lot = lots.find((item) => item.id === take.id);
        if (!lot) continue;
        spent += take.qty * lot.unitCost.toNumber();
        await this.prisma.stockLot.update({
          where: { id: take.id },
          data: { qty: new Prisma.Decimal((lot.qty.toNumber() - take.qty).toString()) },
        });
      }
      unitCost = qty ? spent / qty : 0;
    } else {
      const worth = lots.reduce((sum, lot) => sum + lot.qty.toNumber() * lot.unitCost.toNumber(), 0);
      unitCost = have ? worth / have : 0;
      let left = qty;
      for (const lot of lots) {
        if (left <= 0) break;
        const take = Math.min(left, lot.qty.toNumber());
        left -= take;
        await this.prisma.stockLot.update({
          where: { id: lot.id },
          data: { qty: new Prisma.Decimal((lot.qty.toNumber() - take).toString()) },
        });
      }
    }
    const projectId = text(body.projectId);
    const kind = text(body.kind) || 'buraxilis';
    if (kind === 'buraxilis' && projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organizationId: ctx.orgId as string },
      });
      if (project) {
        await this.prisma.project.update({
          where: { id: project.id },
          data: { spent: { increment: new Prisma.Decimal((unitCost * qty).toFixed(2)) } },
        });
      }
    }
    return { method, unitCost, qty, kind, projectCost: kind === 'buraxilis' ? unitCost * qty : 0 };
  }

  async listLots(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'warehouse');
    const [lots, policy] = await Promise.all([
      this.prisma.stockLot.findMany({
        where: { organizationId: ctx.orgId as string },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.warehousePolicy.findUnique({ where: { organizationId: ctx.orgId as string } }),
    ]);
    return { method: policy?.method ?? 'orta', lots };
  }

  async setStockMethod(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'warehouse');
    const method = text(body.method) === 'fifo' ? 'fifo' : 'orta';
    return this.prisma.warehousePolicy.upsert({
      where: { organizationId: ctx.orgId as string },
      create: { organizationId: ctx.orgId as string, method },
      update: { method },
    });
  }

  async stockAct(ctx: TenantCtx, body: Record<string, unknown>) {
    const kind = text(body.kind) || 'qebul';
    if (kind === 'qebul' || kind === 'qaytarma') return this.receiveLot(ctx, body);
    if (kind === 'kocurme') {
      const issued = await this.issueLot(ctx, { ...body, kind: 'kocurme' });
      const opened = await this.receiveLot(ctx, {
        ...body,
        locationId: text(body.toLocationId),
        unitCost: issued.unitCost,
      });
      return { ...issued, movedTo: opened.id };
    }
    return this.issueLot(ctx, { ...body, kind: kind === 'itki' ? 'itki' : 'buraxilis' });
  }

  async lotByQr(ctx: TenantCtx, qr: string) {
    this.tenant.allow(ctx, 'warehouse');
    const lot = await this.prisma.stockLot.findFirst({
      where: { qr, organizationId: ctx.orgId as string },
    });
    if (!lot) throw new NotFoundException('QR tapılmadı');
    return lot;
  }

  async saveTalent(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'people');
    return this.prisma.talent.create({
      data: {
        organizationId: ctx.orgId as string,
        name: required(body.name, 'Ad'),
        profession: required(body.profession, 'Peşə'),
        education: text(body.education),
        skills: text(body.skills),
        regions: text(body.regions),
        startOn: day(body.startOn),
        phone: text(body.phone),
        email: text(body.email),
        state: (text(body.state) || 'tesdiq') as Prisma.TalentCreateInput['state'],
        expectPay: money(body.expectPay),
        shareConsent: body.shareConsent === true,
      },
    });
  }

  async addProof(ctx: TenantCtx, talentId: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'people');
    const talent = await this.prisma.talent.findFirst({
      where: { id: talentId, organizationId: ctx.orgId as string },
    });
    if (!talent) throw new NotFoundException('Profil tapılmadı');
    return this.prisma.talentProof.create({
      data: {
        talentId,
        source: (text(body.source) || 'el') as Prisma.TalentProofCreateInput['source'],
        title: required(body.title, 'Sənəd'),
        years: money(body.years),
        confirmed: body.confirmed === true,
        note: text(body.note),
      },
    });
  }

  async searchTalent(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'people');
    const profession = text(body.profession);
    const minYears = num(body.minYears) ?? 0;
    const region = text(body.region).toLocaleLowerCase('az');
    const certificate = text(body.certificate).toLocaleLowerCase('az');
    const rows = await this.prisma.talent.findMany({
      where: {
        profession: profession ? { contains: profession, mode: 'insensitive' } : undefined,
        OR: [{ organizationId: ctx.orgId as string }, { shareConsent: true }],
      },
      include: { proofs: true },
    });
    return rows
      .map((row) => {
        const years = confirmedYears(
          row.proofs.map((proof) => ({
            years: proof.years?.toNumber() ?? null,
            confirmed: proof.confirmed,
          })),
        );
        const own = row.organizationId === ctx.orgId;
        return {
          id: row.id,
          name: own || row.shareConsent ? row.name : 'Gizli profil',
          profession: row.profession,
          state: row.state,
          regions: row.regions,
          confirmedYears: years,
          phone: own ? row.phone : '',
          proofs: row.proofs.filter((proof) => own || (proof.confirmed && row.shareConsent)).map((proof) => ({
            source: proof.source,
            title: proof.title,
            years: proof.years,
            note: proof.note,
            confirmed: proof.confirmed,
          })),
          fits: years + 1e-9 >= minYears,
        };
      })
      .filter((row) => {
        if (!row.fits) return false;
        if (region && !String(row.regions).toLocaleLowerCase('az').includes(region)) return false;
        if (!certificate) return true;
        const today = new Date().toISOString().slice(0, 10);
        return row.proofs.some((proof) => {
          if (proof.source !== 'sertifikat') return false;
          if (!proof.title.toLocaleLowerCase('az').includes(certificate)) return false;
          return !proof.note || proof.note >= today;
        });
      });
  }

  async saveOpening(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'people');
    return this.prisma.jobOpening.create({
      data: {
        organizationId: ctx.orgId as string,
        profession: required(body.profession, 'Peşə'),
        minYears: money(body.minYears),
        region: text(body.region),
        startOn: day(body.startOn),
        certificate: text(body.certificate),
        note: text(body.note),
      },
    });
  }

  async saveTariff(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'people');
    const on = day(body.updatedOn) ?? new Date();
    return this.prisma.laborTariff.create({
      data: {
        organizationId: ctx.orgId as string,
        profession: required(body.profession, 'Peşə'),
        region: text(body.region),
        daily: money(body.daily),
        monthly: money(body.monthly),
        perUnit: money(body.perUnit),
        unit: text(body.unit) || 'eded',
        complexity: text(body.complexity),
        experience: text(body.experience),
        updatedOn: on,
      },
    });
  }

  async saveMachine(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'catalog');
    const rate = money(body.rate);
    if (!rate) throw new BadRequestException('Tarif yazılmalıdır');
    return this.prisma.machineTariff.create({
      data: {
        organizationId: ctx.orgId as string,
        category: required(body.category, 'Texnika'),
        region: text(body.region),
        rateUnit: (text(body.rateUnit) || 'gun') as Prisma.MachineTariffCreateInput['rateUnit'],
        rate,
        fuel: money(body.fuel),
        operator: body.operator === true,
        delivery: money(body.delivery),
        minDays: num(body.minDays) == null ? null : Math.round(num(body.minDays) as number),
        updatedOn: day(body.updatedOn) ?? new Date(),
      },
    });
  }

  async saveRental(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'catalog');
    const rate = money(body.rate);
    if (!rate) throw new BadRequestException('İcarə qiyməti yazılmalıdır');
    return this.prisma.rentalOffer.create({
      data: {
        organizationId: ctx.orgId as string,
        category: required(body.category, 'Kateqoriya'),
        brand: text(body.brand),
        model: text(body.model),
        year: num(body.year) == null ? null : Math.round(num(body.year) as number),
        place: text(body.place),
        available: body.available !== false,
        rateUnit: (text(body.rateUnit) || 'gun') as Prisma.RentalOfferCreateInput['rateUnit'],
        rate,
        operator: body.operator === true,
        fuelNote: text(body.fuelNote),
        delivery: money(body.delivery),
        inspection: text(body.inspection),
      },
    });
  }

  marketRentals(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'cabinet');
    return this.prisma.rentalOffer.findMany({
      where: { available: true },
      select: {
        id: true,
        category: true,
        brand: true,
        model: true,
        place: true,
        rateUnit: true,
        rate: true,
        operator: true,
        delivery: true,
        organization: { select: { name: true, regions: true } },
      },
    });
  }

  async openChain(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'boq');
    const kind = (text(body.kind) || 'smeta') as Prisma.ApprovalChainCreateInput['kind'];
    return this.prisma.approvalChain.create({
      data: {
        organizationId: ctx.orgId as string,
        kind,
        subject: required(body.subject, 'Sənəd'),
        steps: {
          create: [
            { sort: 1, role: 'smeta' },
            { sort: 2, role: 'layihe' },
            { sort: 3, role: 'muhasib' },
            { sort: 4, role: 'direktor' },
          ],
        },
      },
      include: { steps: true },
    });
  }

  async actStep(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.requireOrg(ctx);
    const step = await this.prisma.approvalStep.findFirst({
      where: { id, chain: { organizationId: ctx.orgId as string } },
      include: { chain: { include: { steps: { orderBy: { sort: 'asc' } } } } },
    });
    if (!step) throw new NotFoundException('Addım tapılmadı');
    if (ctx.seat !== 'direktor' && ctx.seat !== step.role) {
      throw new ForbiddenException('Bu addım sizin səlahiyyətinizdə deyil');
    }
    const earlier = step.chain.steps.filter((item) => item.sort < step.sort && item.state !== 'tesdiq');
    if (earlier.length) throw new BadRequestException('Əvvəlki təsdiq bitməyib');
    const state = text(body.state) === 'geri' ? 'geri' : 'tesdiq';
    return this.prisma.approvalStep.update({
      where: { id },
      data: { state, person: ctx.name, at: new Date(), note: text(body.note) },
    });
  }

  async projectFinance(ctx: TenantCtx, projectId: string) {
    this.tenant.allow(ctx, 'finance');
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: ctx.orgId as string },
    });
    if (!project) throw new NotFoundException('Layihə tapılmadı');
    const expenses = await this.prisma.expense.findMany({ where: { project: project.name,organizationId:ctx.orgId } });
    const fact = expenses.reduce((sum, row) => sum + row.amount.toNumber(), 0);
    const cash = await this.prisma.cashPlan.findFirst({ where: { projectId,organizationId:ctx.orgId } });
    return {
      budget: project.budget,
      spent: project.spent,
      expenseFact: fact,
      gap: variance(project.budget.toNumber(), fact),
      cash,
      reasons: ['Material qiyməti', 'Normadan artıq sərf', 'Tullantı', 'Səhv qiymət', 'Əlavə iş', 'Təsdiqsiz satınalma'],
    };
  }

  async saveCash(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'finance');
    const projectId = text(body.projectId) || null;
    return this.prisma.cashPlan.create({
      data: {
        organizationId: ctx.orgId as string,
        projectId,
        inflow: money(body.inflow),
        advance: money(body.advance),
        equity: money(body.equity),
        loan: money(body.loan),
        days30: money(body.days30),
        days60: money(body.days60),
        days90: money(body.days90),
      },
    });
  }

  async listSchedules(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'weather');
    const schedules = await this.prisma.workSchedule.findMany({
      where: { organizationId: ctx.orgId as string },
      include: {
        project: { select: { name: true } },
        tasks: { orderBy: { sort: 'asc' } },
      },
    });
    const projectIds = schedules.map((row) => row.projectId).filter((id): id is string => Boolean(id));
    const proofs = projectIds.length
      ? await this.prisma.weatherProof.findMany({
          where: { projectId: { in: projectIds } },
          orderBy: { date: 'asc' },
        })
      : [];
    return schedules
      .map((row) => ({
        id: row.id,
        bondDay: row.bondDay,
        projectId: row.projectId,
        project: row.project,
        tasks: row.tasks.map((task) => ({
          id: task.id,
          name: task.name,
          startDay: task.startDay,
          endDay: task.endDay,
        })),
        weather: proofs
          .filter((proof) => proof.projectId === row.projectId)
          .map((proof) => ({
            id: proof.id,
            rain: proof.rain?.toNumber() ?? null,
            wind: proof.wind?.toNumber() ?? null,
            pouring: proof.pouring,
            stop: proof.stop,
            officer: proof.officer,
          })),
      }))
      .sort((a, b) => (a.project?.name || '').localeCompare(b.project?.name || '', 'az'));
  }

  async saveSchedule(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'weather');
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];
    const schedule = await this.prisma.workSchedule.create({
      data: {
        organizationId: ctx.orgId as string,
        projectId: text(body.projectId) || null,
        bondDay: num(body.bondDay) == null ? null : Math.round(num(body.bondDay) as number),
        tasks: {
          create: tasks.map((task, sort) => {
            const row = task as Record<string, unknown>;
            return {
              sort,
              name: required(row.name, 'İş'),
              startDay: num(row.startDay) == null ? null : Math.round(num(row.startDay) as number),
              endDay: num(row.endDay) == null ? null : Math.round(num(row.endDay) as number),
              dependsOn: text(row.dependsOn),
              actualEnd: num(row.actualEnd) == null ? null : Math.round(num(row.actualEnd) as number),
            };
          }),
        },
      },
      include: { tasks: true },
    });
    return { schedule, late: scheduleSlip(schedule.tasks) };
  }

  async recordWeather(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'weather');
    const date = day(body.date);
    if (!date) throw new BadRequestException('Tarix yazılmalıdır');
    const rain = num(body.rainPercent);
    const wind = num(body.windMs);
    if (rain == null || wind == null) throw new BadRequestException('Yağış və külək yazılmalıdır');
    const rules = await this.prisma.safetyRule.findMany();
    const stops = weatherStops(
      rules.map((rule) => ({
        rainAt: rule.rainAt?.toNumber() ?? null,
        windAt: rule.windAt?.toNumber() ?? null,
        pouring: rule.pouring,
        stops: rule.stops,
        active: rule.active,
      })),
      { rainPercent: rain, windMs: wind, pouring: body.pouring === true },
    );
    return this.prisma.weatherDay.upsert({
      where: { date },
      create: {
        date,
        rainPercent: new Prisma.Decimal(rain.toString()),
        windMs: new Prisma.Decimal(wind.toString()),
        pouring: body.pouring === true,
        source: text(body.source) || 'əl ilə',
        stops,
        note: text(body.note),
      },
      update: {
        rainPercent: new Prisma.Decimal(rain.toString()),
        windMs: new Prisma.Decimal(wind.toString()),
        pouring: body.pouring === true,
        source: text(body.source) || 'əl ilə',
        stops,
        note: text(body.note),
      },
    });
  }

  safetyRules(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'weather');
    return this.prisma.safetyRule.findMany({ where: { active: true } });
  }

  async financePartners(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'finance');
    const rows = await this.prisma.financePartner.findMany({
      include: { products: { include: { discounts: true } } },
    });
    const today = new Date();
    return rows.map((row) => ({
      ...row,
      light: greenPartner(row.proof, row.proofDate) ? row.light : 'gozleme',
      api: 'bagli',
      products: row.products.map((product) => ({
        ...product,
        visible: product.confirmed && !isStale(product.validUntil, today),
        discounts: product.discounts.filter((item) =>
          discountLive(
            { confirmed: item.confirmed, startsOn: item.startsOn, endsOn: item.endsOn },
            today,
          ),
        ),
      })),
    }));
  }

  async savePartner(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.admin(ctx);
    const proof = text(body.proof);
    const proofDate = day(body.proofDate);
    const asked = text(body.light) === 'tesdiq';
    if (asked && !greenPartner(proof, proofDate)) {
      throw new BadRequestException('Yaşıl işıq üçün təsdiq sənədi və tarixi yazılmalıdır');
    }
    return this.prisma.financePartner.create({
      data: {
        kind: (text(body.kind) || 'bank') as Prisma.FinancePartnerCreateInput['kind'],
        name: required(body.name, 'Tərəfdaş'),
        note: text(body.note),
        logo: text(body.logo),
        commission: money(body.commission),
        discount: money(body.discount),
        proof,
        proofDate,
        light: asked ? 'tesdiq' : 'gozleme',
        api: 'bagli',
        contact: text(body.contact),
        productsNote: text(body.productsNote),
      },
    });
  }

  async updatePartner(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.admin(ctx);
    const current = await this.prisma.financePartner.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Tərəfdaş tapılmadı');
    const proof = body.proof == null ? current.proof : text(body.proof);
    const proofDate = body.proofDate == null ? current.proofDate : day(body.proofDate);
    const asked = text(body.light) === 'tesdiq';
    if (asked && !greenPartner(proof, proofDate)) {
      throw new BadRequestException('Yaşıl işıq üçün təsdiq sənədi və tarixi yazılmalıdır');
    }
    return this.prisma.financePartner.update({
      where: { id },
      data: {
        name: text(body.name) || undefined,
        note: body.note == null ? undefined : text(body.note),
        logo: body.logo == null ? undefined : text(body.logo),
        commission: body.commission == null ? undefined : money(body.commission),
        discount: body.discount == null ? undefined : money(body.discount),
        proof,
        proofDate,
        light: body.light == null ? undefined : asked ? 'tesdiq' : text(body.light) === 'legv' ? 'legv' : 'gozleme',
      },
    });
  }

  async saveFinanceProduct(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.admin(ctx);
    return this.prisma.financeProduct.create({
      data: {
        partnerId: required(body.partnerId, 'Tərəfdaş'),
        line: required(body.line, 'Məhsul növü') as Prisma.FinanceProductCreateInput['line'],
        name: required(body.name, 'Ad'),
        terms: text(body.terms),
        commission: money(body.commission),
        rate: money(body.rate),
        termDays: num(body.termDays) == null ? null : Math.round(num(body.termDays) as number),
        confirmed: body.confirmed === true,
        validUntil: day(body.validUntil),
      },
    });
  }

  async compareProducts(ctx: TenantCtx, line: string) {
    this.tenant.allow(ctx, 'finance');
    const rows = await this.prisma.financeProduct.findMany({
      where: { line: line as Prisma.FinanceProductWhereInput['line'], confirmed: true },
      include: { partner: true, discounts: true },
    });
    const today = new Date();
    return {
      preliminary: rows.some((row) => row.rate == null || row.commission == null),
      rows: rows
        .filter((row) => greenPartner(row.partner.proof, row.partner.proofDate))
        .map((row) => ({
          id: row.id,
          name: row.name,
          partner: row.partner.name,
          rate: row.rate,
          commission: row.commission,
          termDays: row.termDays,
          discounts: row.discounts.filter((item) =>
            discountLive({ confirmed: item.confirmed, startsOn: item.startsOn, endsOn: item.endsOn }, today),
          ),
        })),
    };
  }

  async openApplication(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'finance');
    if (body.consent !== true) {
      throw new BadRequestException('Banka və ya sığortaçıya göndəriş üçün razılıq qeyd olunmalıdır');
    }
    const kind = required(body.kind, 'Müraciət növü') as Prisma.FinanceApplicationCreateInput['kind'];
    const app = await this.prisma.financeApplication.create({
      data: {
        organizationId: ctx.orgId as string,
        partnerId: text(body.partnerId) || null,
        productId: text(body.productId) || null,
        kind,
        status: 'qaralama',
        amount: money(body.amount),
        purpose: text(body.purpose),
        payload: (body.payload ?? {}) as Prisma.InputJsonValue,
        packed: true,
        consentAt: new Date(),
        events: { create: { status: 'qaralama', person: ctx.name, note: 'Paket hazırdır. Canlı bank bağlantısı yoxdur.' } },
      },
      include: { events: true },
    });
    await this.prisma.shareConsent.create({
      data: {
        organizationId: ctx.orgId as string,
        partnerId: text(body.partnerId) || null,
        purpose: text(body.purpose) || kind,
        categories: text(body.categories) || 'müraciət paketi',
      },
    });
    return { application: app, channel: 'sened' };
  }

  async applicationStatus(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'finance');
    const app = await this.prisma.financeApplication.findFirst({
      where: { id, organizationId: ctx.orgId as string },
    });
    if (!app) throw new NotFoundException('Müraciət tapılmadı');
    const status = required(body.status, 'Status') as Prisma.FinanceApplicationUpdateInput['status'];
    return this.prisma.financeApplication.update({
      where: { id },
      data: {
        status,
        events: { create: { status: status as Prisma.ApplicationEventCreateInput['status'], person: ctx.name, note: text(body.note) } },
      },
      include: { events: true },
    });
  }

  async officialCheck(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'legal');
    const state = text(body.state) || 'gonderilmeyib';
    if (state === 'alindi' && (!text(body.document) || !day(body.asOf))) {
      throw new BadRequestException('Alınmış məlumat üçün sənəd və tarix yazılmalıdır');
    }
    return this.prisma.officialInquiry.create({
      data: {
        organizationId: ctx.orgId as string,
        topic: required(body.topic, 'Mövzu') as Prisma.OfficialInquiryCreateInput['topic'],
        state: state as Prisma.OfficialInquiryCreateInput['state'],
        channel: 'sened',
        source: text(body.source),
        resultNote: text(body.resultNote),
        document: text(body.document),
        asOf: day(body.asOf),
      },
    });
  }

  async guaranteePack(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'finance');
    const mode = text(body.mode) === 'percent' ? 'percent' : 'fixed';
    const calc = guaranteeAmount(mode, num(body.base), num(body.value));
    return this.prisma.guaranteeCase.create({
      data: {
        organizationId: ctx.orgId as string,
        kind: (text(body.kind) || 'istirak') as Prisma.GuaranteeCaseCreateInput['kind'],
        mode,
        amount: money(calc.amount),
        rate: mode === 'percent' ? money(body.value) : null,
        partnerId: text(body.partnerId) || null,
        buyer: text(body.buyer),
        title: text(body.title),
        days: num(body.days) == null ? null : Math.round(num(body.days) as number),
        packed: true,
        reviewed: false,
        light: 'gozleme',
        consentAt: body.consent === true ? new Date() : null,
      },
    });
  }

  async savePassport(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'quality');
    return this.prisma.materialPassport.create({
      data: {
        organizationId: ctx.orgId as string,
        material: required(body.material, 'Material'),
        section: text(body.section),
        fit: (FITS.has(text(body.fit)) ? text(body.fit) : 'el') as Prisma.MaterialPassportCreateInput['fit'],
        maker: text(body.maker),
        standard: text(body.standard),
        certificate: text(body.certificate),
        issuer: text(body.issuer),
        validUntil: day(body.validUntil),
        batch: text(body.batch),
        origin: text(body.origin),
        protocol: text(body.protocol),
      },
    });
  }

  async matchPassport(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'quality');
    const card = await this.prisma.materialPassport.findFirst({
      where: { id, organizationId: ctx.orgId as string },
    });
    if (!card) throw new NotFoundException('Pasport tapılmadı');
    const need = text(body.requirement).toLocaleLowerCase('az');
    const hay = `${card.standard} ${card.section} ${card.certificate}`.toLocaleLowerCase('az');
    const hit = need.length > 0 && hay.includes(need);
    const fit = hit ? 'uygun' : card.certificate ? 'el' : 'catismir';
    return this.prisma.materialPassport.update({ where: { id }, data: { fit } });
  }

  async defect(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'quality');
    return this.prisma.defectAct.create({
      data: {
        organizationId: ctx.orgId as string,
        projectId: text(body.projectId) || null,
        material: required(body.material, 'Material'),
        qty: money(body.qty),
        reason: required(body.reason, 'Səbəb'),
        visual: text(body.visual),
        certificate: text(body.certificate),
        person: text(body.person) || ctx.name,
      },
    });
  }

  async incident(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'quality');
    const on = day(body.on);
    if (!on) throw new BadRequestException('Tarix yazılmalıdır');
    return this.prisma.siteIncident.create({
      data: {
        organizationId: ctx.orgId as string,
        projectId: text(body.projectId) || null,
        kind: required(body.kind, 'Növ'),
        text: required(body.text, 'Qeyd'),
        on,
        person: ctx.name,
      },
    });
  }

  async photo(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'quality');
    return this.prisma.projectPhoto.create({
      data: {
        organizationId: ctx.orgId as string,
        projectId: text(body.projectId) || null,
        title: required(body.title, 'Başlıq'),
        takenOn: day(body.takenOn),
        note: text(body.note),
        url: text(body.url),
      },
    });
  }

  async saveTemplate(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'legal');
    return this.prisma.legalTemplate.create({
      data: {
        organizationId: ctx.orgId as string,
        name: required(body.name, 'Ad'),
        kind: required(body.kind, 'Növ'),
        version: text(body.version) || '1',
        updatedOn: new Date(),
        legal: text(body.legal) || 'Gözləyir',
        party: text(body.party),
        status: 'Hazır şablon',
        body: text(body.body),
      },
    });
  }

  async renderTemplate(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'legal');
    const template = await this.prisma.legalTemplate.findFirst({
      where: { id, OR: [{ organizationId: ctx.orgId as string }, { organizationId: null }] },
    });
    if (!template) throw new NotFoundException('Şablon tapılmadı');
    const org = await this.prisma.organization.findUnique({ where: { id: ctx.orgId as string } });
    const fields: Record<string, string> = {
      sirket: org?.name ?? '',
      voen: org?.voen ?? '',
      unvan: org?.legalAddress ?? '',
      tarix: new Date().toISOString().slice(0, 10),
    };
    const extra = body.fields;
    if (extra && typeof extra === 'object') {
      for (const [key, value] of Object.entries(extra as Record<string, unknown>)) {
        fields[key] = text(value);
      }
    }
    return {
      name: template.name,
      version: template.version,
      legal: template.legal,
      text: fillTemplate(template.body, fields),
      replacesCounsel: false,
    };
  }

  taxRules(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'finance');
    return this.prisma.taxRule.findMany({ orderBy: { effectiveOn: 'desc' } });
  }

  async saveTaxRule(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'finance');
    const rate = num(body.rate);
    const on = day(body.effectiveOn);
    if (rate == null || !on) throw new BadRequestException('Dərəcə və qüvvəyə minmə tarixi yazılmalıdır');
    const confirmed = body.confirmed === true;
    return this.prisma.taxRule.create({
      data: {
        code: required(body.code, 'Vergi kodu'),
        name: required(body.name, 'Vergi adı'),
        rate: new Prisma.Decimal(rate.toString()),
        effectiveOn: on,
        note: `${confirmed ? `Təsdiq: ${ctx.name}` : 'Mühasib təsdiqi gözləyir'}. ${text(body.note)} ƏDV ${text(body.vatMode) === 'daxil' ? 'daxildir' : 'xaricdir'}. Bəyannamə orqana getmir.`.trim(),
      },
    });
  }

  async explainTax(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'finance');
    const code = required(body.code, 'Vergi kodu');
    const on = day(body.on) ?? new Date();
    const rule = await this.prisma.taxRule.findFirst({
      where: { code, effectiveOn: { lte: on } },
      orderBy: { effectiveOn: 'desc' },
    });
    if (!rule) throw new NotFoundException('Bu tarixə qayda yoxdur');
    const base = num(body.base) ?? 0;
    const amount = (base * rule.rate.toNumber()) / 100;
    return {
      rule,
      amount,
      explanation: `${rule.name}: ${base} × ${rule.rate}% = ${amount}. Mühasib təsdiq etməlidir.`,
      filed: false,
    };
  }

  async coop(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'org');
    return this.prisma.coopRequest.create({
      data: {
        organizationId: ctx.orgId as string,
        company: required(body.company, 'Tərəf'),
        note: text(body.note),
        module: text(body.module),
        owner: text(body.owner),
        result: text(body.result),
        status: 'Təhlil olunur',
      },
    });
  }

  async coopFinding(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'org');
    const request = await this.prisma.coopRequest.findFirst({
      where: { id, organizationId: ctx.orgId as string },
    });
    if (!request) throw new NotFoundException('Sorğu tapılmadı');
    const finding = await this.prisma.coopFinding.create({
      data: {
        requestId: id,
        topic: required(body.topic, 'Mövzu'),
        finding: required(body.finding, 'Nəticə'),
      },
    });
    await this.prisma.coopRequest.update({
      where: { id },
      data: {
        module: text(body.module) || request.module,
        owner: text(body.owner) || request.owner,
        result: required(body.finding, 'Nəticə'),
        status: text(body.status) || 'Nəticə yazılıb',
      },
    });
    return finding;
  }

  async saveRule(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'calc');
    return this.prisma.tradeRule.create({
      data: {
        organizationId: ctx.orgId as string,
        trade: required(body.trade, 'İstehsal növü') as Prisma.TradeRuleCreateInput['trade'],
        system: required(body.system, 'Sistem'),
        confirmed: body.confirmed === true,
        kgPerM: money(body.kgPerM),
        wastePercent: money(body.wastePercent),
        glassDeductMm: money(body.glassDeductMm),
        glassWastePercent: money(body.glassWastePercent),
        panelKgPerM2: money(body.panelKgPerM2),
        coverPerM2: money(body.coverPerM2),
        overlapMm: money(body.overlapMm),
        postSpacingM: money(body.postSpacingM),
        unit: text(body.unit),
        labor: money(body.labor),
        rawPrice: money(body.rawPrice),
        salePrice: money(body.salePrice),
      },
    });
  }

  listRules(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'calc');
    return this.prisma.tradeRule.findMany({
      where: { organizationId: ctx.orgId as string },
      orderBy: { updatedAt: 'desc' },
    });
  }

  listProjects(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'cabinet');
    return this.prisma.project.findMany({
      where: { organizationId: ctx.orgId as string },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async project(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'cabinet');
    return this.prisma.project.create({
      data: {
        organizationId: ctx.orgId as string,
        name: required(body.name, 'Layihə'),
        clientName: text(body.clientName),
        district: text(body.district),
        city: text(body.city),
        address: text(body.address),
        phase: text(body.phase) || 'Hazırlıq',
        budget: money(body.budget) ?? new Prisma.Decimal(0),
        start: text(body.start),
        end: text(body.end),
        manager: text(body.manager) || ctx.name,
        status: 'plan',
        type: text(body.type) || 'tikinti',
        floors: Math.round(num(body.floors) ?? 1),
        area: money(body.area) ?? new Prisma.Decimal(0),
      },
    });
  }

  payPreview(ctx: TenantCtx, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'people');
    const hours = num(body.hours) ?? 0;
    const daily = num(body.daily) ?? 0;
    const perUnit = num(body.perUnit) ?? 0;
    const qty = num(body.qty) ?? 0;
    const amount = text(body.mode) === 'vahid' ? perUnit * qty : daily * (hours / 8);
    return {
      amount,
      draft: true,
      note: 'Bu qaralama mühasib təsdiqi üçündür. Rəsmi əməkhaqqı mövcud maaş cədvəlində aparılır.',
    };
  }

  async notices(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'cabinet');
    return this.prisma.notice.findMany({
      where: { organizationId: ctx.orgId as string, read: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminSummary(ctx: TenantCtx) {
    this.tenant.admin(ctx);
    const [companies, subs, products, tenders, talents, disputes, charges] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.orgSubscription.count({ where: { status: 'aktiv' } }),
      this.prisma.catalogProduct.count(),
      this.prisma.tenderCase.count(),
      this.prisma.talent.count(),
      this.prisma.dispute.count({ where: { status: 'aciq' } }),
      this.prisma.serviceCharge.findMany({ where: { status: 'qeyd' } }),
    ]);
    const revenue = charges.reduce((sum, row) => sum + (row.amount?.toNumber() ?? 0), 0);
    return { companies, subs, products, tenders, talents, disputes, revenue };
  }

  async supportLook(ctx: TenantCtx, id: string, reason: string) {
    this.tenant.admin(ctx);
    if (!reason.trim()) throw new BadRequestException('Baxışın səbəbi yazılmalıdır');
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, kind: true, voen: true, phone: true, email: true },
    });
    if (!org) throw new NotFoundException('Şirkət tapılmadı');
    await this.tenant.audit(ctx, 'destek', `${org.code} səbəb: ${reason}`);
    return org;
  }

  async listInquiries(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'legal');
    return this.prisma.officialInquiry.findMany({
      where: { organizationId: ctx.orgId as string },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPassports(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'quality');
    return this.prisma.materialPassport.findMany({
      where: { organizationId: ctx.orgId as string },
      orderBy: { material: 'asc' },
    });
  }

  async listCoop(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'org');
    return this.prisma.coopRequest.findMany({
      where: { organizationId: ctx.orgId as string },
      include: { findings: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTemplate(ctx: TenantCtx, id: string, body: Record<string, unknown>) {
    this.tenant.allow(ctx, 'legal');
    const current = await this.prisma.legalTemplate.findFirst({
      where: { id, organizationId: ctx.orgId as string },
    });
    if (!current) throw new NotFoundException('Şablon tapılmadı');
    return this.prisma.legalTemplate.update({
      where: { id },
      data: {
        name: required(body.name, 'Ad'),
        kind: required(body.kind, 'Növ'),
        version: text(body.version) || current.version || '1',
        updatedOn: new Date(),
        legal: text(body.legal) || 'Gözləyir',
        party: text(body.party),
        status: 'Hazır şablon',
        body: text(body.body),
      },
    });
  }

  async listTemplates(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'legal');
    return this.prisma.legalTemplate.findMany({
      where: { OR: [{ organizationId: ctx.orgId as string }, { organizationId: null }] },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listOpenings(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'people');
    return this.prisma.jobOpening.findMany({
      where: { organizationId: ctx.orgId as string },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listTalent(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'people');
    return this.prisma.talent.findMany({
      where: { organizationId: ctx.orgId as string },
      include: { proofs: true },
      orderBy: { name: 'asc' },
    });
  }

  async listApplications(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'finance');
    return this.prisma.financeApplication.findMany({
      where: { organizationId: ctx.orgId as string },
      include: { events: { orderBy: { at: 'desc' } }, partner: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listGuarantees(ctx: TenantCtx) {
    this.tenant.allow(ctx, 'finance');
    return this.prisma.guaranteeCase.findMany({
      where: { organizationId: ctx.orgId as string },
      include: { partner: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  meta() {
    return {
      chain: ['tender', 'fayl', 'smeta', 'sorgu', 'sifaris', 'anbar', 'xercler'],
      held: [
        'etender oxuma',
        'SIMA',
        'vergi borcu sorğusu',
        'müflisləşmə sorğusu',
        'e-müqavilə',
        'Məşğulluq Agentliyi',
        'bank və sığorta API',
        'kart ödənişi',
      ],
    };
  }

  private async mathFrom(body: Record<string, unknown>) {
    const ruleId = text(body.ruleId);
    const rule = ruleId
      ? await this.prisma.tradeRule.findUnique({ where: { id: ruleId } })
      : null;
    return windowMath(
      {
        width: body.width,
        height: body.height,
        count: body.count,
        sections: body.sections,
        opening: text(body.opening) || 'doner',
        profileUnit: text(body.profileUnit) || 'm',
        profileRate: body.profileRate,
        glassRate: body.glassRate,
        hardwareRate: body.hardwareRate,
        laborRate: body.laborRate,
        installRate: body.installRate,
        packRate: body.packRate,
        transport: body.transport,
        extra: body.extra,
        vat: body.vat ?? 18,
        profit: body.profit ?? 10,
        profitMode: text(body.profitMode) === 'marja' ? 'marja' : 'faiz',
        glassConfirmed: body.glassConfirmed === true,
        installKind: text(body.installKind),
      },
      rule
        ? {
            confirmed: rule.confirmed,
            kgPerM: rule.kgPerM,
            wastePercent: rule.wastePercent,
            glassDeductMm: rule.glassDeductMm,
            glassWastePercent: rule.glassWastePercent,
          }
        : undefined,
    );
  }

  private async guardSmetaLimit(orgId: string) {
    const sub = await this.prisma.orgSubscription.findUnique({
      where: { organizationId: orgId },
      include: { package: true },
    });
    if (sub?.status !== 'aktiv') {
      throw new ForbiddenException('Smeta üçün aktiv abunə qeydi yoxdur');
    }
    if (sub.package.smetaLimit == null) return;
    const count = await this.prisma.boqBook.count({ where: { organizationId: orgId } });
    if (count >= sub.package.smetaLimit) {
      throw new ForbiddenException('Paketin smeta həddi dolub');
    }
  }

  private presentProduct(
    row: {
      id: string;
      name: string;
      price: Prisma.Decimal;
      cost: Prisma.Decimal | null;
      validUntil: Date | null;
    },
    own: boolean,
  ) {
    return {
      ...row,
      cost: own ? row.cost : null,
      stale: isStale(row.validUntil, new Date()),
    };
  }
}
