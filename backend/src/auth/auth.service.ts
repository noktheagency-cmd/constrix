import {
  ConflictException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { isRole, type Role } from './access';
import { PrismaService } from '../prisma/prisma.service';
import { signToken } from './token';

const PASSWORD = 'Afez2026!';

type CoopSeed = {
  id: string;
  company: string;
  note: string;
  module: string;
  owner: string;
  result: string;
  status: string;
  createdAt: string;
  findings: { id: string; topic: string; finding: string; createdAt: string }[];
};

const AFEZ_COOP: CoopSeed[] = [
  {
    id: 'coop-afez-alum',
    company: 'Xəzər Alüminium Sistemləri',
    note: 'Port Baku fasadı üçün antrasit profil. Təklifdə gümüş rəng gəlib, çertyojla tutuşdurulmalıdır.',
    module: 'Tender',
    owner: 'Nigar Əliyeva',
    result: '',
    status: 'Təhlil olunur',
    createdAt: '2026-10-02',
    findings: [
      { id: 'coop-afez-alum-1', topic: 'Rəng', finding: 'Sifarişdə antrasit yazılıb, təklif vərəqində gümüş profildir.', createdAt: '2026-10-03' },
    ],
  },
  {
    id: 'coop-afez-glass',
    company: 'Abşeron Şüşə',
    note: '6 mm temperli şüşə. Köhnə qiymət vaxtı keçib, yeni partiya və çatdırılma müddəti soruşulur.',
    module: 'Təchizat',
    owner: 'Səbinə Əhmədova',
    result: 'Yeni partiya 18.40 AZN/m² qəbul olunur, çatdırılma 12 iş günüdür.',
    status: 'Nəticə yazılıb',
    createdAt: '2026-09-18',
    findings: [
      { id: 'coop-afez-glass-1', topic: 'Qiymət', finding: 'Əvvəlki 6 mm qiymət etibarlı deyil. Yeni partiya 18.40 AZN/m², ƏDV xaric.', createdAt: '2026-09-20' },
      { id: 'coop-afez-glass-2', topic: 'Müddət', finding: 'Sumqayıt anbarından sahəyə 12 iş günü.', createdAt: '2026-09-21' },
    ],
  },
  {
    id: 'coop-afez-pvc',
    company: 'Qafqaz PVC Profil',
    note: 'Yasamal yaşayışında iki pəncərə açılışı çertyojla tutmur.',
    module: 'Hesablama',
    owner: 'Nigar Əliyeva',
    result: '',
    status: 'Təhlil olunur',
    createdAt: '2026-10-08',
    findings: [
      { id: 'coop-afez-pvc-1', topic: 'Ölçü', finding: 'Mətbəx və lojiya açılışları çertyojdan 12 mm fərqlənir. Sex təsdiqi gözlənilir.', createdAt: '2026-10-09' },
    ],
  },
  {
    id: 'coop-afez-rebar',
    company: 'Kür Armatur və İnert',
    note: 'A500 Ø16 armatur. Sertifikat və 42 ton qalıq təsdiqi.',
    module: 'Təchizat',
    owner: 'Səbinə Əhmədova',
    result: '42 ton təsdiqləndi. Anbara 6 günə gəlir.',
    status: 'Razılaşıb',
    createdAt: '2026-09-04',
    findings: [
      { id: 'coop-afez-rebar-1', topic: 'Sertifikat', finding: 'Diametr və partiya nömrəsi sertifikatla üst-üstə düşür.', createdAt: '2026-09-06' },
    ],
  },
  {
    id: 'coop-afez-paint',
    company: 'Azər Boya İstehsalat',
    note: 'Xəzər Business Center fasad boyası. Rəng nümunəsi RAL 7016 ilə tutuşdurulur.',
    module: 'İnşaat',
    owner: 'Rauf Hüseynov',
    result: 'Köhnə partiya qəbul olunmur. Yeni nümunə gözlənilir.',
    status: 'Dayanıb',
    createdAt: '2026-09-26',
    findings: [
      { id: 'coop-afez-paint-1', topic: 'Rəng', finding: 'Gələn partiya nümunədən tünddür. Köhnə partiya sahəyə buraxılmır.', createdAt: '2026-09-28' },
    ],
  },
  {
    id: 'coop-afez-facade',
    company: 'Fasad Konstruksiya',
    note: 'Anker sayı smetada azdır. Əlavə iş aktı yazılmalıdır.',
    module: 'Tender',
    owner: 'Elvin Məmmədov',
    result: 'Əlavə iş aktı imza gözləyir. Məbləğ smetaya düşməyib.',
    status: 'Nəticə yazılıb',
    createdAt: '2026-10-01',
    findings: [
      { id: 'coop-afez-facade-1', topic: 'Həcm', finding: 'Əlavə 186 anker. Akt layihə rəhbərinə göndərildi.', createdAt: '2026-10-04' },
    ],
  },
  {
    id: 'coop-afez-log',
    company: 'Şüşədaşıma Lojistik',
    note: 'Şüşə daşınanda iki paket çatmayıb. Akt və əvəz partiya lazımdır.',
    module: 'Təchizat',
    owner: 'Murad Cəfərov',
    result: '',
    status: 'Təhlil olunur',
    createdAt: '2026-10-11',
    findings: [
      { id: 'coop-afez-log-1', topic: 'Çatışmazlıq', finding: 'İki paket aktı sürücüdədir, anbar hələ qəbul etməyib.', createdAt: '2026-10-12' },
    ],
  },
  {
    id: 'coop-afez-door',
    company: 'Nokhte Qapı',
    note: 'Qapı partiyası üzrə avans və ödəniş qrafiki.',
    module: 'Maliyyə',
    owner: 'Günel Rzayeva',
    result: 'Qrafik razılaşdırıldı. Avans qaiməsi açıldı.',
    status: 'Razılaşıb',
    createdAt: '2026-08-21',
    findings: [
      { id: 'coop-afez-door-1', topic: 'Ödəniş', finding: '30% avans, qalan məbləğ təhvil aktından 14 gün sonra.', createdAt: '2026-08-24' },
    ],
  },
];

function shiftCoop(rows: CoopSeed[], from: string, to: string): CoopSeed[] {
  return rows.map((row) => ({
    ...row,
    id: row.id.replace(from, to),
    findings: row.findings.map((item) => ({ ...item, id: item.id.replace(from, to) })),
  }));
}

const QAPI_COOP: CoopSeed[] = [
  {
    id: 'coop-qapi-afez',
    company: 'AFEZ İnşaat',
    note: 'Port Baku üçün 240 ədəd alüminium qapı. Montaj müddəti və cərimə şərti açıqdır.',
    module: 'Tender',
    owner: 'Elvin Məmmədov',
    result: '',
    status: 'Təhlil olunur',
    createdAt: '2026-10-06',
    findings: [
      { id: 'coop-qapi-afez-1', topic: 'Montaj', finding: 'Montaj qrafiki 18 gün gecikir. Cərimə bəndi hüquqşünasa verilib.', createdAt: '2026-10-07' },
    ],
  },
  {
    id: 'coop-qapi-glass',
    company: 'Abşeron Şüşə',
    note: 'Vitrin şüşəsi 8 mm. Sex anbarına həftəlik plan bağlanmalıdır.',
    module: 'Təchizat',
    owner: 'Səbinə Əhmədova',
    result: 'Həftəlik plan bağlandı.',
    status: 'Razılaşıb',
    createdAt: '2026-09-12',
    findings: [
      { id: 'coop-qapi-glass-1', topic: 'Plan', finding: 'Həftədə 180 m², çərşənbə axşamı boşaldılır.', createdAt: '2026-09-14' },
    ],
  },
  {
    id: 'coop-qapi-log',
    company: 'Şüşədaşıma Lojistik',
    note: 'Hazır qapıların Yasamal sahəsinə daşınması.',
    module: 'Təchizat',
    owner: 'Murad Cəfərov',
    result: 'Reyslər təsdiqləndi. Sığorta sənədi gözlənilir.',
    status: 'Nəticə yazılıb',
    createdAt: '2026-10-09',
    findings: [
      { id: 'coop-qapi-log-1', topic: 'Marşrut', finding: 'İki reys çərşənbə və cümə. Sığorta aktı yoldadır.', createdAt: '2026-10-10' },
    ],
  },
  {
    id: 'coop-qapi-paint',
    company: 'Azər Boya İstehsalat',
    note: 'Antrasit toz boya. Rəng kodu sex nümunəsi ilə eyni olmalıdır.',
    module: 'İnşaat',
    owner: 'Aysel Həsənova',
    result: 'Partiya geri qaytarılır.',
    status: 'Dayanıb',
    createdAt: '2026-09-29',
    findings: [
      { id: 'coop-qapi-paint-1', topic: 'Rəng', finding: 'Son partiya gümüşə çalır. Sex boyamır.', createdAt: '2026-09-30' },
    ],
  },
];

const ACCOUNTS: {
  email: string;
  userId: string;
  name: string;
  role: Role;
  title: string;
  initials: string;
}[] = [
  {
    email: 'elvin@afez.az',
    userId: 'U-01',
    name: 'Elvin Məmmədov',
    role: 'director',
    title: 'Əməliyyat direktoru',
    initials: 'EM',
  },
  {
    email: 'nigar@afez.az',
    userId: 'U-02',
    name: 'Nigar Əliyeva',
    role: 'pm',
    title: 'Layihə rəhbəri',
    initials: 'NƏ',
  },
  {
    email: 'rauf@afez.az',
    userId: 'U-03',
    name: 'Rauf Hüseynov',
    role: 'site',
    title: 'Sahə mühəndisi',
    initials: 'RH',
  },
  {
    email: 'kamran@afez.az',
    userId: 'U-04',
    name: 'Kamran Əliyev',
    role: 'warehouse',
    title: 'Anbar müdiri',
    initials: 'KƏ',
  },
  {
    email: 'sebine@afez.az',
    userId: 'U-05',
    name: 'Səbinə Əhmədova',
    role: 'procurement',
    title: 'Təchizatçı',
    initials: 'SƏ',
  },
  {
    email: 'gunel@afez.az',
    userId: 'U-06',
    name: 'Günel Rzayeva',
    role: 'accountant',
    title: 'Mühasib',
    initials: 'GR',
  },
  {
    email: 'aysel@afez.az',
    userId: 'U-07',
    name: 'Aysel Həsənova',
    role: 'sales',
    title: 'Satış rəhbəri',
    initials: 'AH',
  },
];

export type AuthUser = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  title: string;
  initials: string;
};

type TokenPayload = AuthUser & { sub: string };

const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; reset: number }>();

@Injectable()
export class AuthService {
  private readonly dummyHash = bcrypt.hash('not-a-real-password', 10);

  constructor(private readonly prisma: PrismaService) {}

  guardLogin(ip: string) {
    const now = Date.now();
    const row = attempts.get(ip);
    if (!row || row.reset < now) {
      attempts.set(ip, { count: 1, reset: now + WINDOW_MS });
      return;
    }
    row.count += 1;
    if (row.count > 8) {
      throw new HttpException('Çox cəhd. Bir az sonra yenidən yoxlayın.', 429);
    }
  }

  async seed() {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    for (const account of ACCOUNTS) {
      const profile = {
        name: account.name,
        role: account.role,
        title: account.title,
        initials: account.initials,
        passwordHash,
      };
      const byEmail = await this.prisma.account.findUnique({
        where: { email: account.email },
      });
      if (byEmail) {
        await this.prisma.account.update({
          where: { email: account.email },
          data: profile,
        });
        continue;
      }
      const byUser = await this.prisma.account.findUnique({
        where: { userId: account.userId },
      });
      if (byUser) {
        await this.prisma.account.update({
          where: { userId: account.userId },
          data: { ...profile, email: account.email },
        });
        continue;
      }
      await this.prisma.account.create({ data: { ...account, passwordHash } });
    }
    await this.seedCompany();
    await this.seedPeople();
    await this.seedLiveCoop();
  }

  private async seedLiveCoop() {
    const live = await this.prisma.organization.findUnique({ where: { code: 'AZ-AFEZ-01' } });
    if (!live) return;
    const rows = shiftCoop(
      AFEZ_COOP.filter((row) => row.id !== 'coop-afez-log'),
      'coop-afez',
      'coop-sxt',
    );
    rows.push({
      id: 'seed-x-coop-6',
      company: 'Şüşədaşıma Lojistik',
      note: 'Şüşə daşınanda iki paket çatmayıb. Marşrut sifarişə bağlanmalıdır.',
      module: 'Təchizat',
      owner: 'Murad Cəfərov',
      result: '',
      status: 'Təhlil olunur',
      createdAt: '2026-10-11',
      findings: [
        {
          id: 'seed-x-coop-6-1',
          topic: 'Çatışmazlıq',
          finding: 'İki paket aktı sürücüdədir, anbar hələ qəbul etməyib.',
          createdAt: '2026-10-12',
        },
      ],
    });
    await this.seedCoop(live.id, rows);
  }

  private async ensureMember(organizationId: string, email: string, seatRole: string) {
    const account = await this.prisma.account.findUnique({ where: { email } });
    if (!account) return;
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, accountId: account.id },
    });
    if (member) return;
    await this.prisma.organizationMember.create({
      data: { organizationId, accountId: account.id, name: account.name, seatRole },
    });
  }

  private async settleActiveOrg(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { activeOrgId: true },
    });
    const rows = await this.prisma.organizationMember.findMany({
      where: { accountId },
      select: { organizationId: true },
    });
    const ids = rows.map((row) => row.organizationId);
    if (account?.activeOrgId && ids.includes(account.activeOrgId)) return;
    const activeOrgId =
      ids.find((id) => id === 'seed-org-afez') ??
      (ids.length === 1 ? ids[0] : null);
    await this.prisma.account.update({
      where: { id: accountId },
      data: { activeOrgId },
    });
  }

  private async seedCompany() {
    const profile = {
      kind: 'tikinti' as const,
      name: 'AFEZ İnşaat',
      voen: '1703456781',
      phone: '+994 12 555 01 01',
      email: 'info@afez.az',
      director: 'Elvin Məmmədov',
      legalAddress: 'Bakı, Nəsimi rayonu, 28 May küçəsi 15',
      actualAddress: 'Bakı, Yasamal, Həsən bəy Zərdabi prospekti 89',
      capacity: 'İllik 40 000 m² tikinti-quraşdırma',
      warehouse: 'Mərkəzi anbar, Sumqayıt',
      regions: 'Bakı, Sumqayıt, Abşeron',
      warranty: '24 ay',
      reliability: 4,
      staffCount: 86,
      directions: 'Yaşayış, ticarət və sənaye tikintisi',
      permits: 'Tikinti fəaliyyəti, FHN razılığı',
      equipmentPark: '6 qüllə kran, 4 beton nasosu, 12 yük maşını',
      turnoverNote: 'Son il dövriyyəsi 18 milyon AZN',
      bankDetails: 'Azərbaycan Beynəlxalq Bankı, AZ12NABZ01350100000000001944',
    };
    const org = await this.prisma.organization.upsert({
      where: { code: 'AFEZ-DEMO' },
      create: { ...profile, code: 'AFEZ-DEMO' },
      update: profile,
    });
    const door = {
      kind: 'qapi' as const,
      name: 'Nokhte Qapı',
      voen: '1804567892',
      phone: '+994 12 440 22 10',
      email: 'qapi@nokhte.az',
      director: 'Elvin Məmmədov',
      legalAddress: 'Bakı, Xətai rayonu, Babək prospekti 42',
      actualAddress: 'Sumqayıt, Sənaye zonası, 7-ci küçə',
      capacity: 'Aylıq 1 200 qapı və pəncərə',
      warehouse: 'Sex anbarı, Sumqayıt',
      regions: 'Bakı, Sumqayıt',
      warranty: '36 ay',
      reliability: 5,
      staffCount: 34,
      directions: 'Alüminium qapı, pəncərə və vitrin',
      permits: 'İstehsal fəaliyyəti',
      equipmentPark: '2 CNC, 1 boya xətti, 4 pres',
      turnoverNote: 'Son il dövriyyəsi 4.2 milyon AZN',
      bankDetails: 'Kapital Bank, AZ21AIIB38060019442001000123',
    };
    const second = await this.prisma.organization.upsert({
      where: { code: 'NOKHTE-QAPI' },
      create: { ...door, code: 'NOKHTE-QAPI' },
      update: door,
    });
    for (const row of [org, second]) {
      await this.prisma.warehousePolicy.upsert({
        where: { organizationId: row.id },
        create: { organizationId: row.id, method: 'orta' },
        update: {},
      });
    }
    const seats: Record<string, string> = {
      'elvin@afez.az': 'direktor',
      'nigar@afez.az': 'layihe',
      'rauf@afez.az': 'sahe',
      'kamran@afez.az': 'anbardar',
      'sebine@afez.az': 'satinalma',
      'gunel@afez.az': 'muhasib',
      'aysel@afez.az': 'satinalma',
    };
    for (const [email, seatRole] of Object.entries(seats)) {
      const account = await this.prisma.account.findUnique({ where: { email } });
      if (!account) continue;
      const memberships = await this.prisma.organizationMember.findMany({
        where: { accountId: account.id },
        include: { organization: { select: { code: true } } },
      });
      const codes = new Set(memberships.map((item) => item.organization.code));
      const hasOwn = memberships.some((item) => item.organization.code !== 'AFEZ-DEMO' && item.organization.code !== 'NOKHTE-QAPI');
      if (!codes.has('AFEZ-DEMO') && !hasOwn) {
        await this.ensureMember(org.id, email, seatRole);
      }
      if (!codes.has('NOKHTE-QAPI')) {
        await this.ensureMember(second.id, email, seatRole);
      }
    }
    await this.seedCoop(org.id, AFEZ_COOP);
    await this.seedCoop(second.id, QAPI_COOP);
  }

  private async seedCoop(organizationId: string, rows: CoopSeed[]) {
    for (const row of rows) {
      await this.prisma.coopRequest.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          organizationId,
          company: row.company,
          note: row.note,
          module: row.module,
          owner: row.owner,
          result: row.result,
          status: row.status,
          createdAt: new Date(row.createdAt),
        },
        update: {
          organizationId,
          company: row.company,
          note: row.note,
          module: row.module,
          owner: row.owner,
          result: row.result,
          status: row.status,
        },
      });
      for (const finding of row.findings) {
        await this.prisma.coopFinding.upsert({
          where: { id: finding.id },
          create: {
            id: finding.id,
            requestId: row.id,
            topic: finding.topic,
            finding: finding.finding,
            createdAt: new Date(finding.createdAt),
          },
          update: { topic: finding.topic, finding: finding.finding },
        });
      }
    }
  }

  private async seedPeople() {
    const rows = [
      { id: 'HR-11', name: 'Elvin Məmmədov', role: 'Əməliyyat direktoru', crew: 'İdarəetmə', site: 'Baş ofis', placeKind: 'ofis', status: 'ofisde', phone: '+994 50 200 00 01', email: 'elvin@afez.az', departmentId: 'DEP-01', pin: '1000001', hired: '2022-03-01', salary: 4500, card: 'EMP-011' },
      { id: 'HR-01', name: 'Nigar Əliyeva', role: 'Layihə rəhbəri', crew: 'Ofis', site: 'Port Baku Residence', placeKind: 'sahe', status: 'sahede', phone: '+994 50 555 10 21', email: 'nigar@afez.az', departmentId: 'DEP-02', pin: '1000002', hired: '2023-01-16', salary: 2800, card: 'EMP-001' },
      { id: 'HR-02', name: 'Kamran Əliyev', role: 'Anbar müdiri', crew: 'Anbar', site: 'Mərkəzi anbar', placeKind: 'istehsal', status: 'istehsalda', phone: '+994 55 412 77 03', email: 'kamran@afez.az', departmentId: 'DEP-06', pin: '1000003', hired: '2023-04-03', salary: 1500, card: 'EMP-002' },
      { id: 'HR-03', name: 'Aysel Həsənova', role: 'Satış rəhbəri', crew: 'Kommersiya', site: 'Baş ofis', placeKind: 'ofis', status: 'ofisde', phone: '+994 50 200 14 90', email: 'aysel@afez.az', departmentId: 'DEP-03', pin: '1000004', hired: '2023-02-12', salary: 2200, card: 'EMP-003' },
      { id: 'HR-04', name: 'Rauf Hüseynov', role: 'Briqadir', crew: 'Karkas-1', site: 'Xəzər Business Center', placeKind: 'sahe', status: 'sahede', phone: '+994 70 318 44 12', email: 'rauf@afez.az', departmentId: 'DEP-08', pin: '1000005', hired: '2024-06-01', salary: 1800, card: 'EMP-004' },
      { id: 'HR-05', name: 'Günel Rzayeva', role: 'Maliyyə', crew: 'Ofis', site: 'Baş ofis', placeKind: 'ofis', status: 'mezuniyyet', phone: '+994 51 620 08 33', email: 'gunel@afez.az', departmentId: 'DEP-04', pin: '1000006', hired: '2023-09-04', salary: 1900, card: 'EMP-005' },
      { id: 'HR-06', name: 'Elşən Qarayev', role: 'Usta', crew: 'Beton', site: 'Beton zavodu', placeKind: 'istehsal', status: 'istehsalda', phone: '+994 55 777 21 64', email: 'elsen@afez.az', departmentId: 'DEP-07', pin: '1000007', hired: '2024-01-15', salary: 1700, card: 'EMP-006' },
      { id: 'HR-07', name: 'Səbinə Əhmədova', role: 'Təchizatçı', crew: 'Təchizat', site: 'Baş ofis', placeKind: 'ofis', status: 'ofisde', phone: '+994 50 441 90 27', email: 'sebine@afez.az', departmentId: 'DEP-05', pin: '1000008', hired: '2024-03-11', salary: 1600, card: 'EMP-007' },
      { id: 'HR-08', name: 'Murad Cəfərov', role: 'Mexanik', crew: 'Texnika', site: 'Servis mərkəzi', placeKind: 'istehsal', status: 'ezamiyyetde', phone: '+994 70 909 15 48', email: 'murad@afez.az', departmentId: 'DEP-09', pin: '1000009', hired: '2024-05-20', salary: 1600, card: 'EMP-008' },
      { id: 'HR-09', name: 'Rəşad Quliyev', role: 'Usta', crew: 'Armatur', site: 'Armatur sexi', placeKind: 'istehsal', status: 'xestelik', phone: '+994 50 616 44 20', email: 'resad@afez.az', departmentId: 'DEP-07', pin: '1000010', hired: '2024-08-01', salary: 1400, card: 'EMP-009' },
      { id: 'HR-10', name: 'Vüsal Məlikov', role: 'Usta', crew: 'Panel', site: 'Panel sexi', placeKind: 'istehsal', status: 'telim', phone: '+994 55 303 18 76', email: 'vusal@afez.az', departmentId: 'DEP-07', pin: '1000011', hired: '2025-02-10', salary: 1400, card: 'EMP-010' },
    ];
    for (const row of rows) {
      await this.prisma.person.upsert({
        where: { id: row.id },
        create: row,
        update: {
          name: row.name,
          role: row.role,
          email: row.email,
          phone: row.phone,
          site: row.site,
          status: row.status,
        },
      });
    }
  }

  async register(name: string, email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    const exists = await this.prisma.account.findUnique({ where: { email: cleanEmail } });
    if (exists) throw new ConflictException('Bu e-poçt artıq yazılıb.');
    const cleanName = name.trim();
    const parts = cleanName.split(/\s+/).filter(Boolean);
    const initials = (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : cleanName.slice(0, 2)).toLocaleUpperCase('az');
    const account = await this.prisma.account.create({
      data: {
        email: cleanEmail,
        passwordHash: await bcrypt.hash(password, 10),
        name: cleanName,
        role: 'director',
        title: 'Direktor',
        initials,
        userId: `U-${crypto.randomUUID()}`,
      },
    });
    const user = this.toUser(account);
    const token = signToken({ ...user, sub: account.id });
    return { token, user };
  }

  async login(email: string, password: string) {
    const account = await this.prisma.account.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    const matches = await bcrypt.compare(
      password,
      account?.passwordHash ?? (await this.dummyHash),
    );
    if (!account || !matches || !isRole(account.role)) {
      throw new UnauthorizedException('E-poçt və ya şifrə yanlışdır.');
    }
    const user = this.toUser(account);
    await this.settleActiveOrg(account.id);
    const token = signToken({ ...user, sub: account.id });
    return { token, user };
  }

  async me(payload: TokenPayload): Promise<AuthUser> {
    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
    });
    if (!account || !isRole(account.role)) throw new UnauthorizedException();
    return this.toUser(account);
  }

  private toUser(account: {
    userId: string;
    email: string;
    name: string;
    role: string;
    title: string;
    initials: string;
  }): AuthUser {
    if (!isRole(account.role)) throw new UnauthorizedException();
    return {
      userId: account.userId,
      email: account.email,
      name: account.name,
      role: account.role,
      title: account.title,
      initials: account.initials,
    };
  }
}
