export type PhaseFlag = {
  name: string;
  done: boolean;
  current: boolean;
  sort: number;
};

export type ProcedureDraft = {
  id: string;
  projectId: string;
  phase: string;
  sort: number;
  name: string;
  detail: string;
  unit: string;
  qty: number;
  doneQty: number;
  doneOn: string;
};

const PHASE_ORDER = [
  'Torpaq',
  'Bünövrə',
  'Karkas',
  'Fasad',
  'Tamamlama',
  'Təhvil',
];

const PHASE_WEIGHT: Record<string, number> = {
  Torpaq: 0.08,
  Bünövrə: 0.12,
  Karkas: 0.34,
  Fasad: 0.22,
  Tamamlama: 0.14,
  Təhvil: 0.1,
};

const CATALOG: {
  phase: string;
  name: string;
  detail: string;
  unit: string;
  price: number;
  share: number;
}[] = [
  {
    phase: 'Torpaq',
    name: 'Sahənin hasarlanması və geodeziya',
    detail:
      'Sahə hasarlanır, oxlar və yüksəklik nişanları vurulur, mövcud kommunikasiya yoxlanılır.',
    unit: 'm²',
    price: 12,
    share: 0.25,
  },
  {
    phase: 'Torpaq',
    name: 'Torpağın çıxarılması',
    detail:
      'Layihə səviyyəsinə qədər qazıntı aparılır və artıq torpaq sahədən daşınır.',
    unit: 'm³',
    price: 28,
    share: 0.5,
  },
  {
    phase: 'Torpaq',
    name: 'Əsasın sıxlaşdırılması',
    detail:
      'Əsas qatı laylarla sıxlaşdırılır, sıxlıq laboratoriya aktı ilə bağlanır.',
    unit: 'm²',
    price: 18,
    share: 0.25,
  },
  {
    phase: 'Bünövrə',
    name: 'Bünövrə armaturu',
    detail:
      'Bünövrə səbəti və lentin armaturu bağlanır, örtük məsafəsi yoxlanılır.',
    unit: 'ton',
    price: 1200,
    share: 0.4,
  },
  {
    phase: 'Bünövrə',
    name: 'Bünövrə betonu',
    detail: 'Bünövrə betonu tökülür, vibrasiya və baxım aparılır.',
    unit: 'm³',
    price: 140,
    share: 0.45,
  },
  {
    phase: 'Bünövrə',
    name: 'Hidroizolyasiya',
    detail: 'Yeraltı hissənin hidroizolyasiyası və qoruyucu qatı vurulur.',
    unit: 'm²',
    price: 22,
    share: 0.15,
  },
  {
    phase: 'Karkas',
    name: 'Karkas betonu',
    detail: 'Sütun, bağ və plitə betonu mərtəbə-mərtəbə tökülür.',
    unit: 'm³',
    price: 110,
    share: 0.55,
  },
  {
    phase: 'Karkas',
    name: 'Armatur karkası',
    detail:
      'Daşıyıcı elementlərin armatur karkası hazırlanır və qəbul edilir.',
    unit: 'ton',
    price: 1200,
    share: 0.45,
  },
  {
    phase: 'Fasad',
    name: 'Fasad alt konstruksiya',
    detail: 'Fasadın alt konstruksiyası oxlara görə quraşdırılır.',
    unit: 'm²',
    price: 86,
    share: 0.5,
  },
  {
    phase: 'Fasad',
    name: 'Pəncərə və şüşə paket',
    detail:
      'Pəncərə blokları və şüşə paketlər taxılır, birləşmə tikişləri bağlanır.',
    unit: 'm²',
    price: 95,
    share: 0.3,
  },
  {
    phase: 'Fasad',
    name: 'Fasad üzləmə',
    detail: 'Üzlük materialı quraşdırılır və fasad müstəvisi yoxlanılır.',
    unit: 'm²',
    price: 74,
    share: 0.2,
  },
  {
    phase: 'Tamamlama',
    name: 'Daxili suvaq və döşəmə',
    detail: 'Divar suvağı, şap və döşəmə örtüyü yerinə yetirilir.',
    unit: 'm²',
    price: 55,
    share: 0.45,
  },
  {
    phase: 'Tamamlama',
    name: 'Mühəndis şəbəkələri',
    detail:
      'Su, kanalizasiya və elektrik şəbəkəsi çəkilir, sınaqdan keçirilir.',
    unit: 'm',
    price: 18,
    share: 0.3,
  },
  {
    phase: 'Tamamlama',
    name: 'Son tamamlama və boya',
    detail: 'Son boya, qapı-taxt və daxili tamamlayıcı işlər görülür.',
    unit: 'm²',
    price: 24,
    share: 0.25,
  },
  {
    phase: 'Təhvil',
    name: 'Qəbul komissiyası və akt',
    detail:
      'Qəbul komissiyası çağırılır, görülən işlər aktla rəsmiləşdirilir.',
    unit: 'dəst',
    price: 1,
    share: 0.4,
  },
  {
    phase: 'Təhvil',
    name: 'Qüsurların aradan qaldırılması',
    detail:
      'Komissiyanın qeyd etdiyi qüsurlar bağlanır və təkrar baxış aparılır.',
    unit: 'dəst',
    price: 1,
    share: 0.4,
  },
  {
    phase: 'Təhvil',
    name: 'Açar və sənəd paketi',
    detail:
      'Açar, icra cizgiləri, zəmanət və istismar sənədləri sifarişçiyə verilir.',
    unit: 'dəst',
    price: 1,
    share: 0.2,
  },
];

function day(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shift(start: string, days: number, cap: string) {
  const base = new Date(`${start.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return cap;
  base.setUTCDate(base.getUTCDate() + days);
  const value = day(base);
  return value > cap ? cap : value;
}

function flagsFor(project: {
  phase: string;
  phases: PhaseFlag[];
}): PhaseFlag[] {
  if (project.phases.length) {
    return [...project.phases].sort((a, b) => a.sort - b.sort);
  }
  const at = PHASE_ORDER.indexOf(project.phase);
  return PHASE_ORDER.map((name, sort) => ({
    name,
    sort,
    done: at > sort,
    current: name === project.phase,
  }));
}

function factor(phases: PhaseFlag[], name: string, progress: number) {
  const index = phases.findIndex((item) => item.name === name);
  const flag = index < 0 ? undefined : phases[index];
  if (flag?.done) return 1;
  if (flag && !flag.current) return 0;
  let start = 0;
  for (let i = 0; i < index; i += 1) {
    start += PHASE_WEIGHT[phases[i].name] ?? 0;
  }
  const weight = PHASE_WEIGHT[name] ?? 0.1;
  const raw = weight <= 0 ? 0 : (progress / 100 - start) / weight;
  return Math.min(0.9, Math.max(0.15, raw));
}

export function buildPhaseProcedures(
  project: {
    id: string;
    phase: string;
    progress: number;
    budget: number;
    start: string;
    phases: PhaseFlag[];
  },
  today = new Date(),
): ProcedureDraft[] {
  const phases = flagsFor(project);
  const cap = day(today);
  const seen = new Map<string, number>();
  return CATALOG.map((item, sort) => {
    const local = seen.get(item.phase) ?? 0;
    seen.set(item.phase, local + 1);
    const phaseIndex = Math.max(
      0,
      phases.findIndex((flag) => flag.name === item.phase),
    );
    const share = PHASE_WEIGHT[item.phase] ?? 0;
    const amount = Math.max(0, project.budget) * share * item.share;
    const qty =
      item.unit === 'dəst'
        ? 1
        : Math.max(1, Math.round(amount / item.price));
    const rate = factor(phases, item.phase, project.progress);
    const doneQty = rate >= 1 ? qty : Math.round(qty * rate * 10) / 10;
    return {
      id: `${project.id}-proc-${sort}`,
      projectId: project.id,
      phase: item.phase,
      sort,
      name: item.name,
      detail: item.detail,
      unit: item.unit,
      qty,
      doneQty,
      doneOn:
        doneQty > 0 ? shift(project.start, phaseIndex * 45 + local * 6, cap) : '',
    };
  });
}
