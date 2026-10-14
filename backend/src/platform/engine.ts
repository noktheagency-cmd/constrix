export type CostLine = {
  name: string;
  unit: string;
  qty: number | null;
  rate: number | null;
  amount: number | null;
  note: string;
};

export type Piece = { name: string; lengthMm: number; qty: number };

export function num(value: unknown) {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function framePieces(
  width: number,
  height: number,
  sections: number,
  count: number,
) {
  const bays = Math.max(1, Math.floor(sections));
  const pieces: Piece[] = [
    { name: 'Üst çərçivə', lengthMm: width, qty: count },
    { name: 'Alt çərçivə', lengthMm: width, qty: count },
    { name: 'Sol çərçivə', lengthMm: height, qty: count },
    { name: 'Sağ çərçivə', lengthMm: height, qty: count },
  ];
  if (bays > 1) {
    pieces.push({
      name: 'Orta bölücü',
      lengthMm: height,
      qty: count * (bays - 1),
    });
  }
  const lengthMm = pieces.reduce(
    (sum, piece) => sum + piece.lengthMm * piece.qty,
    0,
  );
  return { pieces, bays, lengthM: lengthMm / 1000 };
}

export function windowMath(
  input: {
    width: unknown;
    height: unknown;
    count: unknown;
    sections: unknown;
    opening: string;
    profileUnit: string;
    profileRate: unknown;
    glassRate: unknown;
    hardwareRate: unknown;
    laborRate: unknown;
    installRate: unknown;
    packRate: unknown;
    transport: unknown;
    extra: unknown;
    vat: unknown;
    profit: unknown;
    profitMode: 'faiz' | 'marja';
    glassConfirmed: boolean;
    installKind: string;
  },
  rule?: {
    confirmed: boolean;
    kgPerM: unknown;
    wastePercent: unknown;
    glassDeductMm: unknown;
    glassWastePercent: unknown;
  },
) {
  const blocked: string[] = [];
  const width = num(input.width);
  const height = num(input.height);
  const count = num(input.count);
  const sections = num(input.sections) ?? 1;
  if (
    width == null ||
    height == null ||
    count == null ||
    width <= 0 ||
    height <= 0 ||
    count <= 0
  ) {
    return {
      ready: false as const,
      blocked: ['En, hündürlük və say yazılmalıdır'],
      pieces: [] as Piece[],
      lengthM: 0,
      weightKg: null as number | null,
      wasteM: null as number | null,
      glassArea: null as number | null,
      cutArea: null as number | null,
      lines: [] as CostLine[],
      cost: null as number | null,
      profit: null as number | null,
      vat: null as number | null,
      sale: null as number | null,
      gross: null as number | null,
    };
  }
  const frame = framePieces(width, height, sections, count);
  const confirmed = Boolean(rule?.confirmed);
  const kgPerM = confirmed ? num(rule?.kgPerM) : null;
  const wastePercent = confirmed ? num(rule?.wastePercent) : null;
  const deduct = confirmed ? num(rule?.glassDeductMm) : null;
  const glassWaste = confirmed ? num(rule?.glassWastePercent) : null;
  if (!confirmed) {
    blocked.push(
      'Profil sistemi təsdiqlənməyib. Kiloqram, kəsim itkisi və şüşənin kəsim ölçüsü ümumi əmsalla doldurulmur.',
    );
  } else {
    if (kgPerM == null) blocked.push('Təsdiqli qaydada kiloqram/metr yoxdur');
    if (wastePercent == null)
      blocked.push('Təsdiqli qaydada kəsim itkisi yoxdur');
    if (deduct == null) blocked.push('Təsdiqli qaydada şüşə payı yoxdur');
  }
  const weightKg = kgPerM == null ? null : frame.lengthM * kgPerM;
  const wasteM =
    wastePercent == null ? null : (frame.lengthM * wastePercent) / 100;
  const opening = (width / 1000) * (height / 1000) * count;
  let cutArea: number | null = null;
  if (deduct != null) {
    const paneW = width / frame.bays - deduct;
    const paneH = height - deduct;
    cutArea =
      paneW > 0 && paneH > 0
        ? (paneW / 1000) * (paneH / 1000) * frame.bays * count
        : null;
    if (cutArea == null) blocked.push('Şüşə payı ölçüdən böyükdür');
  } else if (input.glassConfirmed) cutArea = opening;
  else blocked.push('Şüşə ölçüsü təsdiqlənməyib');
  const cutWithWaste =
    cutArea == null || glassWaste == null
      ? cutArea
      : cutArea * (1 + glassWaste / 100);
  if (confirmed && glassWaste == null)
    blocked.push('Təsdiqli qaydada şüşə itkisi yoxdur');
  const hardwareQty = input.opening === 'sabit' ? 0 : count;

  function line(
    name: string,
    unit: string,
    qty: number | null,
    rateRaw: unknown,
    note = '',
  ): CostLine {
    const rate = num(rateRaw);
    const amount =
      qty == null ? null : qty === 0 ? 0 : rate == null ? null : qty * rate;
    return {
      name,
      unit,
      qty,
      rate,
      amount,
      note: amount == null ? 'Miqdar və ya qiymət yoxdur' : note,
    };
  }

  const profileQty =
    input.profileUnit === 'kq' ? weightKg : frame.lengthM + (wasteM ?? 0);
  const lines: CostLine[] = [
    line(
      'Alüminium profil',
      input.profileUnit,
      profileQty,
      input.profileRate,
      wasteM == null && input.profileUnit === 'm'
        ? 'İtki qaydası yoxdur, uzunluq itkizsizdir'
        : '',
    ),
    line(
      'Şüşə',
      'm2',
      confirmed && glassWaste != null ? cutWithWaste : cutArea,
      input.glassRate,
    ),
    line('Furnitur və aksesuar', 'dest', hardwareQty, input.hardwareRate),
    line('İstehsal əməkhaqqı', 'eded', count, input.laborRate),
    line('Qablaşdırma', 'eded', count, input.packRate),
    line(
      'Montaj',
      'eded',
      input.installKind.trim() ? count : 0,
      input.installKind.trim() ? input.installRate : 0,
    ),
    line('Daşınma', 'sifaris', 1, input.transport),
    line('Əlavə xərc', 'sifaris', 1, input.extra ?? 0),
  ];
  if (lines.some((item) => item.amount == null))
    blocked.push('Bəzi xərc sətirlərinin qiyməti yoxdur');
  const complete =
    lines.every((item) => item.amount != null) && blocked.length === 0;
  const cost = complete
    ? lines.reduce((sum, item) => sum + (item.amount ?? 0), 0)
    : null;
  const profitRate = num(input.profit);
  let profit: number | null = null;
  let sale: number | null = null;
  if (cost != null && profitRate != null) {
    if (input.profitMode === 'marja') {
      if (profitRate >= 100 || profitRate < 0)
        blocked.push('Marja 0 ilə 100 arasında olmalıdır');
      else {
        sale = cost / (1 - profitRate / 100);
        profit = sale - cost;
      }
    } else {
      profit = (cost * profitRate) / 100;
      sale = cost + profit;
    }
  } else if (cost == null) blocked.push('Maya tam deyil, satış qiyməti bağlanmır');
  const vatRate = num(input.vat);
  const vat = sale != null && vatRate != null ? (sale * vatRate) / 100 : null;
  const gross = sale != null && vat != null ? sale + vat : null;
  return {
    ready: true as const,
    blocked,
    pieces: frame.pieces,
    lengthM: frame.lengthM,
    weightKg,
    wasteM,
    glassArea: opening,
    cutArea,
    lines,
    cost,
    profit,
    vat,
    sale,
    gross,
  };
}

export function logisticsMath(input: {
  km: unknown;
  tariff: unknown;
  weight: unknown;
  capacityKg: unknown;
  glassWidth: unknown;
  glassHeight: unknown;
  maxGlassMm: unknown;
  vehicle: 'standart' | 'suse';
  roundTrip: boolean;
  loadCost: unknown;
  waitCost: unknown;
  extra: unknown;
  speed: unknown;
  days: unknown;
}) {
  const oneWay = num(input.km);
  const tariff = num(input.tariff);
  const weight = num(input.weight);
  const capacity = num(input.capacityKg);
  const glass = Math.max(num(input.glassWidth) ?? 0, num(input.glassHeight) ?? 0);
  const maxGlass = num(input.maxGlassMm);
  const notes: string[] = [];
  if (oneWay == null || oneWay < 0) {
    notes.push(
      'Məsafə yazılmalıdır. Xəritə xidməti bağlanmayıb, təsdiqli məsafə əl ilə daxil edilir.',
    );
  }
  if (tariff == null) notes.push('Kilometr tarifi yazılmalıdır');
  let fit: 'uygun' | 'tutum' | 'olcu' = 'uygun';
  if (weight != null && capacity != null && weight > capacity) {
    fit = 'tutum';
    notes.push('Yük seçilmiş maşının tutumunu aşır');
  }
  if (input.vehicle === 'standart' && maxGlass != null && glass > maxGlass) {
    fit = 'olcu';
    notes.push('Şüşə ölçüsü standart maşına sığmır. Şüşədaşıyan seçilməlidir.');
  }
  const km = oneWay == null ? null : input.roundTrip ? oneWay * 2 : oneWay;
  const load = num(input.loadCost) ?? 0;
  const wait = num(input.waitCost) ?? 0;
  const extra = num(input.extra) ?? 0;
  const cost =
    km == null || tariff == null || fit !== 'uygun'
      ? null
      : km * tariff + load + wait + extra;
  const speed = num(input.speed);
  const days =
    km != null && speed != null && speed > 0
      ? Math.ceil(km / speed)
      : num(input.days);
  if (days == null) notes.push('Çatdırılma müddəti və ya günlük yol yazılmalıdır');
  return { km, cost, days, fit, notes };
}

export function pickPrice(
  base: number | null,
  breaks: { minQty: number; size: string; spec: string; delivery: string; price: number | null }[],
  qty: number,
  size: string,
  spec: string,
  delivery: string,
) {
  const fits = breaks.filter((row) => {
    if (qty + 1e-9 < row.minQty) return false;
    if (row.size.trim() && row.size.trim() !== size.trim()) return false;
    if (row.spec.trim() && row.spec.trim() !== spec.trim()) return false;
    if (row.delivery.trim() && row.delivery.trim() !== delivery.trim()) return false;
    return row.price != null;
  });
  fits.sort((a, b) => b.minQty - a.minQty);
  return fits[0]?.price ?? base;
}

export function isStale(validUntil: Date | null, today: Date) {
  if (!validUntil) return false;
  const end = new Date(validUntil);
  end.setHours(0, 0, 0, 0);
  const day = new Date(today);
  day.setHours(0, 0, 0, 0);
  return end < day;
}

export function boqTotals(input: {
  lines: { qty: number; material: number; labor: number }[];
  costs: { amount: number }[];
  gearInsurance: number;
  profit: number;
  profitMode: 'faiz' | 'marja';
  vat: number;
}) {
  const material = input.lines.reduce(
    (sum, line) => sum + line.qty * line.material,
    0,
  );
  const labor = input.lines.reduce((sum, line) => sum + line.qty * line.labor, 0);
  const extras =
    input.costs.reduce((sum, row) => sum + row.amount, 0) + input.gearInsurance;
  const base = material + labor + extras;
  let profit = 0;
  let sale = base;
  if (input.profitMode === 'marja') {
    if (input.profit >= 100 || input.profit < 0) {
      return { material, labor, extras, base, profit: null, sale: null, vat: null, gross: null, blocked: 'Marja 0 ilə 100 arasında olmalıdır' };
    }
    sale = base / (1 - input.profit / 100);
    profit = sale - base;
  } else {
    profit = (base * input.profit) / 100;
    sale = base + profit;
  }
  const vat = (sale * input.vat) / 100;
  return {
    material,
    labor,
    extras,
    base,
    profit,
    sale,
    vat,
    gross: sale + vat,
    blocked: '',
  };
}

export function guaranteeAmount(
  mode: 'percent' | 'fixed',
  base: number | null,
  value: number | null,
) {
  if (value == null) return { amount: null, source: 'Məbləğ və ya faiz yazılmayıb' };
  if (mode === 'fixed') return { amount: value, source: 'Sabit məbləğ' };
  if (base == null) return { amount: null, source: 'Faiz üçün tender məbləği yoxdur' };
  return { amount: (base * value) / 100, source: 'Tender məbləğinin faizi' };
}

export function issueStock(onHand: number, qty: number) {
  if (!(qty > 0)) return { ok: false as const, left: onHand, reason: 'Miqdar sıfırdan böyük olmalıdır' };
  if (qty > onHand + 1e-9) {
    return { ok: false as const, left: onHand, reason: 'Anbar qalığı sıfırdan aşağı düşə bilməz' };
  }
  return { ok: true as const, left: onHand - qty, reason: '' };
}

export function weightedAverage(lots: { qty: number; unitCost: number }[], addQty: number, addCost: number) {
  const oldQty = lots.reduce((sum, lot) => sum + lot.qty, 0);
  const oldValue = lots.reduce((sum, lot) => sum + lot.qty * lot.unitCost, 0);
  const qty = oldQty + addQty;
  if (qty <= 0) return null;
  return (oldValue + addQty * addCost) / qty;
}

export function fifoIssue(lots: { id: string; qty: number; at: number }[], qty: number) {
  const ordered = [...lots].sort((a, b) => a.at - b.at);
  let left = qty;
  const taken: { id: string; qty: number }[] = [];
  for (const lot of ordered) {
    if (left <= 1e-9) break;
    const take = Math.min(lot.qty, left);
    if (take > 0) taken.push({ id: lot.id, qty: take });
    left -= take;
  }
  if (left > 1e-6) return { ok: false as const, taken, reason: 'Anbar qalığı sıfırdan aşağı düşə bilməz' };
  return { ok: true as const, taken, reason: '' };
}

export function compareBids(
  bids: { id: string; unitPrice: number | null; leadDays: number | null; quality: string; delivery: number | null }[],
) {
  const priced = bids.filter((bid) => bid.unitPrice != null) as {
    id: string;
    unitPrice: number;
    leadDays: number | null;
    quality: string;
    delivery: number | null;
  }[];
  if (!priced.length) {
    return { preliminary: true, rows: bids.map((bid) => ({ ...bid, score: null, note: 'Qiymət yoxdur' })) };
  }
  const min = Math.min(...priced.map((bid) => bid.unitPrice));
  const rows = bids.map((bid) => {
    if (bid.unitPrice == null) return { ...bid, score: null, note: 'Qiymət yoxdur, müqayisə ilkindir' };
    let score = 100 - ((bid.unitPrice - min) / (min || 1)) * 40;
    if (bid.leadDays == null) score -= 15;
    else score -= Math.min(20, bid.leadDays);
    if (!bid.quality.trim()) score -= 15;
    if (bid.delivery == null) score -= 10;
    return {
      ...bid,
      score: Math.round(score * 10) / 10,
      note: 'Ən aşağı qiymət tək seçim meyarı deyil',
    };
  });
  return { preliminary: bids.some((bid) => bid.unitPrice == null || !bid.quality.trim()), rows };
}

export function weatherStops(
  rules: { rainAt: number | null; windAt: number | null; pouring: boolean; stops: string; active: boolean }[],
  day: { rainPercent: number; windMs: number; pouring: boolean },
) {
  return rules
    .filter((rule) => rule.active)
    .filter((rule) => {
      if (rule.pouring && day.pouring) return true;
      if (rule.rainAt != null && day.rainPercent >= rule.rainAt) return true;
      if (rule.windAt != null && day.windMs >= rule.windAt) return true;
      return false;
    })
    .map((rule) => rule.stops);
}

export function addDays(start: Date, days: number) {
  const next = new Date(start);
  next.setDate(next.getDate() + days);
  return next;
}

export function scheduleSlip(tasks: { endDay: number | null; actualEnd: number | null; dependsOn: string; id: string }[]) {
  return tasks
    .filter((task) => task.endDay != null && task.actualEnd != null && task.actualEnd > task.endDay)
    .map((task) => ({
      id: task.id,
      late: (task.actualEnd ?? 0) - (task.endDay ?? 0),
      blocked: tasks.some((other) => other.dependsOn === task.id),
    }));
}

export function confirmedYears(proofs: { years: number | null; confirmed: boolean }[]) {
  return proofs
    .filter((proof) => proof.confirmed && proof.years != null)
    .reduce((sum, proof) => sum + (proof.years ?? 0), 0);
}

export function greenPartner(proof: string, proofDate: Date | null) {
  return proof.trim().length > 0 && proofDate != null;
}

export function discountLive(
  row: { confirmed: boolean; startsOn: Date | null; endsOn: Date | null },
  today: Date,
) {
  if (!row.confirmed) return false;
  const day = new Date(today);
  day.setHours(0, 0, 0, 0);
  if (row.startsOn && row.startsOn > day) return false;
  if (row.endsOn && row.endsOn < day) return false;
  return true;
}

export function tenderAlerts(deadline: Date | null, today: Date) {
  if (!deadline) return [] as string[];
  const ms = deadline.getTime() - today.getTime();
  const hours = ms / 36e5;
  const alerts: string[] = [];
  if (hours <= 24 && hours > 0) alerts.push('Tenderin bitməsinə 24 saat qalıb');
  else if (hours <= 72 && hours > 24) alerts.push('Tenderin bitməsinə 3 gün qalıb');
  else if (hours <= 168 && hours > 72) alerts.push('Tenderin bitməsinə 7 gün qalıb');
  else if (hours <= 0) alerts.push('Təqdimetmə vaxtı keçib');
  return alerts;
}

const HEADER: Record<string, string> = {
  ad: 'name',
  name: 'name',
  mehsul: 'name',
  məhsul: 'name',
  kod: 'code',
  code: 'code',
  say: 'qty',
  qty: 'qty',
  miqdar: 'qty',
  en: 'width',
  width: 'width',
  hundurluk: 'height',
  hündürlük: 'height',
  height: 'height',
  profil: 'profile',
  suse: 'glass',
  şüşə: 'glass',
  glass: 'glass',
  furnitur: 'hardware',
  hardware: 'hardware',
  spesifikasiya: 'spec',
  spec: 'spec',
  montaj: 'install',
  vahid: 'unit',
  unit: 'unit',
};

export type ParsedRow = {
  name: string;
  code: string;
  qty: string;
  width: string;
  height: string;
  profile: string;
  glass: string;
  hardware: string;
  spec: string;
  install: string;
  flags: string[];
  confirmed: boolean;
};

function blankRow(name: string, flags: string[]): ParsedRow {
  return {
    name,
    code: '',
    qty: '',
    width: '',
    height: '',
    profile: '',
    glass: '',
    hardware: '',
    spec: '',
    install: '',
    flags,
    confirmed: false,
  };
}

export function parseTable(text: string): ParsedRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const head = lines[0].split(delimiter).map((cell) => cell.trim().toLocaleLowerCase('az'));
  const keys = head.map((cell) => HEADER[cell] ?? '');
  if (!keys.includes('name') && !keys.includes('qty')) {
    return [blankRow(lines[0].slice(0, 180), ['qeyri-deqiq'])];
  }
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter);
    const row = blankRow('', []);
    keys.forEach((key, index) => {
      if (!key || key === 'unit') return;
      const value = (cells[index] ?? '').trim();
      if (key in row && key !== 'flags' && key !== 'confirmed') {
        (row as unknown as Record<string, string>)[key] = value;
      }
    });
    if (!row.name) row.flags.push('qeyri-deqiq');
    if (!row.qty) row.flags.push('qeyri-deqiq');
    return row;
  });
}

export function scanUpload(name: string, text: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const allowed = ['pdf', 'xls', 'xlsx', 'csv', 'txt', 'docx', 'dwg', 'dxf', 'ifc', 'rvt'];
  if (!allowed.includes(ext)) {
    return { scan: 'redd' as const, note: 'Format qəbul edilmir', rows: [] as ParsedRow[] };
  }
  if (/<script|javascript:/i.test(text)) {
    return { scan: 'redd' as const, note: 'Faylda icra olunan məzmun var', rows: [] as ParsedRow[] };
  }
  if (ext === 'dwg' || ext === 'rvt' || ext === 'xls' || ext === 'xlsx' || ext === 'docx') {
    return {
      scan: 'temiz' as const,
      note: 'Fayl qəbul olundu. Avtomatik oxuma bu formatda təsdiqsizdir, sətirlər yoxlanmalıdır.',
      rows: [blankRow(name, ['oxunmadi'])],
    };
  }
  if (ext === 'pdf' || ext === 'ifc' || ext === 'dxf') {
    const rows = text.trim()
      ? [blankRow(text.slice(0, 180), ['qeyri-deqiq'])]
      : [blankRow(name, ['oxunmadi'])];
    return {
      scan: 'temiz' as const,
      note: 'Mətn çıxarışı ilkindir. Ölçü və miqdar təsdiq olunmalıdır. OCR və CAD nüvəsi qoşulmayıb.',
      rows,
    };
  }
  return { scan: 'temiz' as const, note: '', rows: parseTable(text) };
}

export function fillTemplate(body: string, fields: Record<string, string>) {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
    return fields[key] ?? '';
  });
}

export function variance(plan: number, fact: number) {
  const diff = fact - plan;
  const percent = plan === 0 ? null : (diff / plan) * 100;
  return { diff, percent };
}

export function orgCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const salt = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AZ-${stamp}-${salt}`;
}
