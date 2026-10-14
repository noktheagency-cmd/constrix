export const TENDER_CHECKS = [
  'Şirkət qeydiyyatı',
  'VÖEN və vergi sənədi',
  'İcazə və lisenziya',
  'Maliyyə hesabatı',
  'Oxşar müqavilə',
  'İcra aktı',
  'Mühəndis diplomu',
  'İşçi təcrübəsi',
  'Texnika sənədi',
  'Keyfiyyət və SƏTƏM',
  'Smeta və qiymət təklifi',
  'İş qrafiki',
  'İştirak təminatı',
  'İcra təminatı öhdəliyi',
] as const;

export type Fit = 'uygun' | 'deyil' | 'catismir' | 'gozleyir' | 'el';

const GEAR = [
  'ekskavator',
  'buldozer',
  'avtokran',
  'qüllə kran',
  'kran',
  'beton nasos',
  'betonqarışdıran',
  'yük maşını',
  'damper',
  'avtokar',
  'katok',
  'qaldırıcı',
  'generator',
];

const RISKS: [RegExp, string][] = [
  [/cərimə|cerime|penya/i, 'Cərimə şərti var. Məbləği tender mətnində təsdiq edin.'],
  [/ekvivalent qəbul edilmir|ekvivalent qebul edilmir/i, 'Ekvivalent marka bağlanıb. Məhsul kartı ilə tutuşdurulmalıdır.'],
  [/qeyri-müəyyən|qeyri müəyyən|sonradan dəqiqləş|təyin ediləcək/i, 'Qeyri-müəyyən bənd var. Avtomatik qəbul olunmur.'],
  [/limitsiz|məhdudiyyətsiz məsuliyyət/i, 'Məsuliyyət həddi açıqdır.'],
  [/100\s*%|yüz faiz/i, 'Tam məbləğ tələbi görünür.'],
];

export type TenderBrief = {
  companyYears: number | null;
  engineerYears: number | null;
  gear: string[];
  papers: string[];
  summary: string;
  risks: string[];
};

export type CompanyFacts = {
  named: boolean;
  voen: boolean;
  permits: boolean;
  turnover: boolean;
  pastWork: boolean;
  hasAct: boolean;
  engineerDiploma: boolean;
  engineerYears: number;
  engineerConfirmed: boolean;
  workerYears: number;
  workerConfirmed: boolean;
  gear: { name: string; documented: boolean }[];
  hasQuality: boolean;
  hasBoq: boolean;
  hasSchedule: boolean;
  hasBidBond: boolean;
  hasPerformBond: boolean;
};

export type CheckRow = { name: string; fit: Fit; why: string };

function yearIn(window: string) {
  const match = window.match(/(\d+(?:[.,]\d+)?)\s*il/);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function yearsNear(text: string, anchor: RegExp) {
  const flags = anchor.flags.includes('g') ? anchor.flags : `${anchor.flags}g`;
  const scan = new RegExp(anchor.source, flags);
  let match = scan.exec(text);
  let found: number | null = null;
  while (match) {
    const window = text.slice(Math.max(0, match.index - 50), match.index + match[0].length + 50);
    const years = yearIn(window);
    if (years != null) found = years;
    match = scan.exec(text);
  }
  return found;
}

function gearHits(hay: string) {
  let rest = hay;
  const found: string[] = [];
  for (const name of [...GEAR].sort((a, b) => b.length - a.length)) {
    if (!rest.includes(name)) continue;
    found.push(name);
    rest = rest.split(name).join(' ');
  }
  return found;
}

function papersFrom(text: string) {
  const lines = text
    .split(/\n|•|;/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 3 && line.length < 120);
  const headed = lines.findIndex((line) => /təqdim edilməli|teqdim edilmeli|sənəd siyahı|sened siyah/i.test(line));
  const pool = headed >= 0 ? lines.slice(headed + 1, headed + 12) : lines;
  const picked = pool.filter((line) =>
    /arayış|arayis|diplom|aktı|akti|hesabat|şəhadət|lisenziya|qrafik|smeta|sertifikat|vöen|voen|müqavilə|muqavile/i.test(line),
  );
  return [...new Set(picked)].slice(0, 12);
}

export function readTenderBrief(text: string): TenderBrief {
  const clean = text.replace(/\s+/g, ' ').trim();
  const companyYears = yearsNear(clean, /təcrüb|tecrub|oxşar iş|oxsar is/i);
  const engineerYears = yearsNear(clean, /mühəndis|muhendis|staj/i);
  const gear = gearHits(clean.toLocaleLowerCase('az'));
  const papers = papersFrom(text);
  const risks = RISKS.filter(([rule]) => rule.test(clean)).map(([, note]) => note);
  const bits = [
    companyYears != null ? `Şirkət təcrübəsi ${companyYears} il tələb olunur.` : '',
    engineerYears != null ? `Mühəndis stajı ${engineerYears} il tələb olunur.` : '',
    gear.length ? `Texnika: ${gear.join(', ')}.` : '',
    papers.length ? `Sənədlər: ${papers.join('; ')}.` : '',
  ].filter(Boolean);
  const summary = bits.length
    ? bits.join(' ')
    : 'Mətdə təcrübə ili, mühəndis stajı, texnika və sənəd siyahısı tapılmadı. Bu bəndlər əl ilə yoxlanılır.';
  return { companyYears, engineerYears, gear, papers, summary, risks };
}

function gearFit(required: string[], owned: CompanyFacts['gear']): { fit: Fit; why: string } {
  if (!required.length) return { fit: 'el', why: 'Mətdə texnika siyahısı yoxdur.' };
  const missing = required.filter((name) => !owned.some((item) => item.name.toLocaleLowerCase('az').includes(name)));
  if (missing.length) return { fit: 'catismir', why: `Bazada yoxdur: ${missing.join(', ')}.` };
  const open = required.filter((name) => owned.some((item) => item.name.toLocaleLowerCase('az').includes(name) && !item.documented));
  if (open.length) return { fit: 'gozleyir', why: `Texnika var, sənədi təsdiqlənməyib: ${open.join(', ')}.` };
  return { fit: 'uygun', why: 'Tələb olunan texnika və sənədi bazadadır.' };
}

function yearFit(need: number | null, have: number, confirmed: boolean, emptyWhy: string): { fit: Fit; why: string } {
  if (need == null) return { fit: 'el', why: emptyWhy };
  if (!confirmed && have <= 0) return { fit: 'catismir', why: 'Təsdiqli staj yoxdur.' };
  if (!confirmed) return { fit: 'gozleyir', why: 'Staj yazılıb, təsdiq sənədi gözləyir.' };
  if (have + 0.001 < need) return { fit: 'deyil', why: `Təsdiqli staj ${have} ildir, tələb ${need} ildir.` };
  return { fit: 'uygun', why: `Təsdiqli staj ${have} ildir.` };
}

export function scoreChecks(brief: TenderBrief, facts: CompanyFacts): CheckRow[] {
  const gear = gearFit(brief.gear, facts.gear);
  const worker = yearFit(brief.companyYears, facts.workerYears, facts.workerConfirmed, 'Mətdə şirkət təcrübəsi ili yoxdur.');
  const engineer = yearFit(brief.engineerYears, facts.engineerYears, facts.engineerConfirmed, 'Mətdə mühəndis stajı yoxdur.');
  const diploma: { fit: Fit; why: string } = facts.engineerDiploma
    ? { fit: 'uygun', why: 'Təsdiqli diplom bazadadır.' }
    : brief.engineerYears != null
      ? { fit: 'catismir', why: 'Mühəndis tələb olunur, təsdiqli diplom yoxdur.' }
      : { fit: 'el', why: 'Mətdə mühəndis tələbi yoxdur.' };
  const rows: Record<string, { fit: Fit; why: string }> = {
    'Şirkət qeydiyyatı': facts.named
      ? { fit: 'uygun', why: 'Şirkət adı və hüquqi ünvan yazılıb.' }
      : { fit: 'catismir', why: 'Hüquqi ad və ya ünvan boşdur.' },
    'VÖEN və vergi sənədi': facts.voen
      ? { fit: 'uygun', why: 'VÖEN yazılıb.' }
      : { fit: 'catismir', why: 'VÖEN boşdur.' },
    'İcazə və lisenziya': facts.permits
      ? { fit: 'gozleyir', why: 'İcazə mətni var. Sənədin özü yoxlanmalıdır.' }
      : { fit: 'catismir', why: 'İcazə yazılmayıb.' },
    'Maliyyə hesabatı': facts.turnover
      ? { fit: 'gozleyir', why: 'Dövriyyə qeydi var. Hesabat faylı təsdiq gözləyir.' }
      : { fit: 'catismir', why: 'Maliyyə qeydi yoxdur.' },
    'Oxşar müqavilə': facts.pastWork
      ? { fit: 'gozleyir', why: 'Əvvəlki iş yazılıb. Müqavilə faylı təsdiq gözləyir.' }
      : { fit: 'catismir', why: 'Oxşar iş yazılmayıb.' },
    'İcra aktı': facts.hasAct
      ? { fit: 'uygun', why: 'Akt sənədi bazadadır.' }
      : { fit: 'catismir', why: 'İcra aktı tapılmadı.' },
    'Mühəndis diplomu': diploma,
    'İşçi təcrübəsi': worker,
    'Texnika sənədi': gear,
    'Keyfiyyət və SƏTƏM': facts.hasQuality
      ? { fit: 'uygun', why: 'Material pasportu və ya keyfiyyət sənədi var.' }
      : { fit: 'catismir', why: 'Keyfiyyət sənədi yoxdur.' },
    'Smeta və qiymət təklifi': facts.hasBoq
      ? { fit: 'uygun', why: 'BOQ sətri var.' }
      : { fit: 'catismir', why: 'BOQ boşdur.' },
    'İş qrafiki': facts.hasSchedule
      ? { fit: 'uygun', why: 'İş qrafikində sətir var.' }
      : { fit: 'catismir', why: 'İş qrafiki boşdur.' },
    'İştirak təminatı': facts.hasBidBond
      ? { fit: 'uygun', why: 'İştirak qarantiyası açılıb.' }
      : { fit: 'catismir', why: 'İştirak qarantiyası yoxdur.' },
    'İcra təminatı öhdəliyi': facts.hasPerformBond
      ? { fit: 'uygun', why: 'İcra qarantiyası açılıb.' }
      : { fit: 'catismir', why: 'İcra qarantiyası yoxdur.' },
  };
  return TENDER_CHECKS.map((name) => ({ name, ...rows[name] }));
}

export function certAlerts(
  rows: { material: string; certificate: string; validUntil: Date | null }[],
  today: Date,
) {
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 30);
  return rows.flatMap((row) => {
    if (!row.validUntil) return [];
    const end = new Date(row.validUntil);
    if (end > limit) return [];
    const label = row.material || row.certificate || 'Sertifikat';
    return [end < today ? `Sertifikatın müddəti bitib: ${label}` : `Sertifikatın müddəti bitir: ${label}`];
  });
}

export function tenderLetter(input: { to: string; number: string; subject: string; lines: string[] }) {
  const who = input.to.trim() || 'şirkət e-poçtu yazılmayıb';
  return [
    `Kimə: ${who}`,
    `Mövzu: Tender ${input.number || '—'} · ${input.subject || 'müddət'}`,
    ...input.lines,
    'Poçt xidməti bağlanmayıb. Məktub kabinetdə saxlandı.',
  ].join('\n');
}
