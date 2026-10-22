import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sample = JSON.parse(readFileSync(path.join(root, 'prisma', 'xocali.json'), 'utf8'));
const direct = process.env.DATABASE_URL;
if (!direct) {
  console.log('No database URL set; skipping Xocalı import');
  process.exit(0);
}

const prisma = new PrismaClient({ datasources: { db: { url: direct } } });
const money2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const qty3 = (value) => Math.round((Number(value) || 0) * 1000) / 1000;
const MONTHS = {
  yanvar: '01', fevral: '02', mart: '03', aprel: '04', may: '05', iyun: '06',
  iyul: '07', avqust: '08', sentyabr: '09', oktyabr: '10', noyabr: '11', dekabr: '12',
};

function sheetDate(sheet, label) {
  const fromSheet = String(sheet || '').match(/^(\d{2})\.(\d{2})\.(\d{2,4})/);
  if (fromSheet) {
    const year = fromSheet[3].length === 2 ? `20${fromSheet[3]}` : fromSheet[3];
    return `${year}-${fromSheet[2]}-${fromSheet[1]}`;
  }
  const lower = String(label || '').toLowerCase();
  const day = lower.match(/(\d{1,2})\s/);
  const year = lower.match(/(20\d{2})/);
  for (const [name, month] of Object.entries(MONTHS)) {
    if (lower.includes(name)) return `${year?.[1] || '2025'}-${month}-${String(day?.[1] || '01').padStart(2, '0')}`;
  }
  return '2025-12-10';
}

async function wipe() {
  await prisma.purchaseActAdjust.deleteMany({ where: { id: { startsWith: 'PAA-' } } });
  await prisma.purchaseActLine.deleteMany({ where: { id: { startsWith: 'PAL-' } } });
  await prisma.purchaseAct.deleteMany({ where: { OR: [{ id: { startsWith: 'PA-' } }, { projectId: 'PRJ-XOCA' }] } });
  await prisma.actLine.deleteMany({ where: { actId: 'AKT-XOCA-APR' } });
  await prisma.act.deleteMany({ where: { id: 'AKT-XOCA-APR' } });
  await prisma.contractSchedule.deleteMany({ where: { contractId: 'MQ-XOCA' } });
  await prisma.contract.deleteMany({ where: { id: 'MQ-XOCA' } });
  await prisma.smetaLine.deleteMany({ where: { smetaId: 'SM-PRJ-XOCA' } });
  await prisma.smeta.deleteMany({ where: { id: 'SM-PRJ-XOCA' } });
  await prisma.projectNote.deleteMany({ where: { projectId: 'PRJ-XOCA' } });
  await prisma.projectPhase.deleteMany({ where: { projectId: 'PRJ-XOCA' } });
  await prisma.project.deleteMany({ where: { id: 'PRJ-XOCA' } });
}

async function main() {
  const expectedLines = sample.smetaLines.length;
  const expectedActs = sample.purchaseActs.length + (sample.adjustments?.length ? 1 : 0);
  const [haveLines, haveActs] = await Promise.all([
    prisma.smetaLine.count({ where: { smetaId: 'SM-PRJ-XOCA' } }),
    prisma.purchaseAct.count({ where: { projectId: 'PRJ-XOCA' } }),
  ]);
  if (haveLines >= expectedLines && haveActs >= expectedActs) {
    console.log(JSON.stringify({ xocali: 'already-loaded', lines: haveLines, purchaseActs: haveActs }));
    return;
  }

  await wipe();
  const meta = sample.project;
  const org = await prisma.organization.findUnique({ where: { id: 'seed-org-afez' }, select: { id: true } });
  const client = await prisma.client.upsert({
    where: { name: meta.client },
    update: {},
    create: {
      id: 'seed-cli-xoca',
      name: meta.client,
      sector: 'Bərpa',
      contact: 'Tapdıq',
      phone: '',
      email: 'xocali@afez.az',
      city: 'Xocalı',
      since: '2025',
    },
  });

  const work = sample.smetaLines.filter((line) => line.kind === 'work');
  const budget = money2(work.reduce((sum, line) => sum + Number(line.qty) * Number(line.unitPrice), 0));
  await prisma.project.create({
    data: {
      id: meta.id,
      name: meta.name,
      clientName: meta.client,
      clientId: client.id,
      district: 'Xocalı',
      city: 'Xocalı',
      address: 'Təzəbinə kəndi',
      phase: 'Tamamlama',
      progress: 18,
      budget,
      spent: 0,
      start: '2025-12-12',
      end: '2026-09-30',
      manager: 'Tapdıq',
      crew: 40,
      status: 'aktiv',
      type: 'Yaşayış',
      floors: 1,
      area: 7200,
      note: 'Nakopitel F2 və alış aktı vərəqlərindən yüklənib.',
      smetaId: 'SM-PRJ-XOCA',
      organizationId: org?.id ?? null,
      phases: {
        create: ['Torpaq', 'Bünövrə', 'Karkas', 'Fasad', 'Tamamlama', 'Təhvil'].map((name, sort) => ({
          id: `PRJ-XOCA-ph-${sort}`,
          name,
          sort,
          done: sort < 4,
          current: name === 'Tamamlama',
        })),
      },
      notes: {
        create: [{ id: 'PN-XOCA-1', date: '2026-04-30', text: 'Aprel Forma-2 təhvilə hazırlandı (nümunə: 2 ev).' }],
      },
    },
  });

  await prisma.smeta.create({
    data: { id: 'SM-PRJ-XOCA', projectId: meta.id, version: 1, status: 'razilasma' },
  });
  const lines = sample.smetaLines.map((line, index) => ({
    id: `SL-${meta.id}-${index + 1}`,
    smetaId: 'SM-PRJ-XOCA',
    sort: index + 1,
    code: line.code || '',
    name: line.name || '',
    unit: line.unit || '',
    qty: qty3(line.qty),
    unitPrice: money2(line.unitPrice),
    doneQty: 0,
    billedQty: 0,
    laborHours: 0,
    recipe: '',
    kind: line.kind || 'work',
    houseNo: line.houseNo || '',
    section: line.section || '',
  }));
  for (const line of lines) {
    if (line.kind !== 'work') continue;
    const april = sample.aprilAct.find((row) => row.houseNo === line.houseNo && row.code === line.code && row.name === line.name)
      || sample.aprilAct.find((row) => row.houseNo === line.houseNo && row.code === line.code);
    if (!april) continue;
    line.doneQty = qty3(april.qty);
    line.billedQty = line.doneQty;
  }
  for (let offset = 0; offset < lines.length; offset += 400) {
    await prisma.smetaLine.createMany({ data: lines.slice(offset, offset + 400) });
  }

  await prisma.contract.create({
    data: {
      id: 'MQ-XOCA',
      projectId: meta.id,
      client: meta.client,
      number: meta.contractNumber,
      signed: meta.contractSigned,
      value: budget,
      advancePct: 15,
      retentionPct: 5,
      vat: 0.18,
      schedule: {
        create: [
          { id: 'XOCA-SCH-1', sort: 1, title: 'Avans', due: meta.contractSigned, share: 0.15, status: 'odenilib' },
          { id: 'XOCA-SCH-2', sort: 2, title: 'Aprel aktı', due: '2026-04-30', share: 0.25, status: 'gonderilib' },
          { id: 'XOCA-SCH-3', sort: 3, title: 'Yekun', due: '2026-09-30', share: 0.6, status: 'gozleyir' },
        ],
      },
    },
  });

  const actLines = lines
    .filter((line) => line.kind === 'work' && line.billedQty > 0)
    .map((line, index) => ({
      id: `AL-XOCA-${index + 1}`,
      actId: 'AKT-XOCA-APR',
      sort: index + 1,
      smetaLineId: line.id,
      code: line.code,
      name: line.name,
      unit: line.unit,
      unitPrice: line.unitPrice,
      qty: line.billedQty,
      cumulativeQty: line.billedQty,
    }));
  const net = money2(actLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0));
  const vat = money2(net * 0.18);
  await prisma.act.create({
    data: {
      id: 'AKT-XOCA-APR',
      number: 'AKT № 1',
      projectId: meta.id,
      project: meta.name,
      client: meta.client,
      contractNumber: meta.contractNumber,
      period: '2026-04',
      date: '2026-04-30',
      net,
      vat,
      gross: money2(net + vat),
      status: 'tesdiq',
    },
  });
  for (let offset = 0; offset < actLines.length; offset += 400) {
    await prisma.actLine.createMany({ data: actLines.slice(offset, offset + 400) });
  }

  for (const [index, raw] of sample.purchaseActs.entries()) {
    const id = `PA-${String(index + 1).padStart(3, '0')}`;
    await prisma.purchaseAct.create({
      data: {
        id,
        number: `AA-${String(index + 1).padStart(3, '0')}`,
        projectId: meta.id,
        project: meta.name,
        objectName: raw.objectName,
        person: raw.person || '',
        date: sheetDate(raw.sheet, raw.dateLabel),
        status: 'tesdiq',
        net: money2(raw.total),
        note: raw.sheet || '',
        organizationId: org?.id ?? null,
        lines: {
          create: raw.lines.map((line, lineIndex) => ({
            id: `PAL-${index + 1}-${lineIndex + 1}`,
            sort: lineIndex + 1,
            materialName: line.materialName || '',
            unit: line.unit || '',
            qty: qty3(line.qty),
            unitPrice: Number(line.unitPrice) || 0,
            amount: money2(line.amount),
            cashPaid: line.cashPaid == null ? null : money2(line.cashPaid),
            firmName: line.firmName || '',
            note: line.note || '',
            sender: line.sender || '',
          })),
        },
      },
    });
  }

  if (sample.adjustments?.length) {
    const netAdjust = money2(sample.adjustments.reduce((sum, row) => sum + Number(row.diffAmount), 0));
    await prisma.purchaseAct.create({
      data: {
        id: 'PA-ELAVE',
        number: 'AA-ELAVE',
        projectId: meta.id,
        project: meta.name,
        objectName: 'Akta əlavə · Fortis Group',
        person: 'Sakit',
        date: '2026-02-11',
        status: 'qaralama',
        net: netAdjust,
        note: 'Qiymət fərqi əlavəsi',
        organizationId: org?.id ?? null,
        adjustments: {
          create: sample.adjustments.map((row, index) => ({
            id: `PAA-${index + 1}`,
            sort: index + 1,
            materialName: row.materialName || '',
            unit: row.unit || '',
            qty: qty3(row.qty),
            unitPrice: Number(row.unitPrice) || 0,
            amount: money2(row.amount),
            diff: Number(row.diff) || 0,
            diffAmount: money2(row.diffAmount),
            actLabel: row.actLabel || '',
          })),
        },
      },
    });
  }

  console.log(JSON.stringify({
    xocali: meta.name,
    smetaLines: lines.length,
    aprilLines: actLines.length,
    purchaseActs: expectedActs,
    budget,
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
