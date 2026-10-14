import {
  boqTotals,
  compareBids,
  confirmedYears,
  fifoIssue,
  greenPartner,
  guaranteeAmount,
  isStale,
  issueStock,
  parseTable,
  scanUpload,
  tenderAlerts,
  variance,
  weatherStops,
  windowMath,
} from './engine';

describe('platform engine', () => {
  const rule = {
    confirmed: true,
    kgPerM: 1.2,
    wastePercent: 5,
    glassDeductMm: 40,
    glassWastePercent: 8,
  };

  it('bağlayır satış qiymətini yalnız təsdiqli qayda ilə', () => {
    const open = windowMath(
      {
        width: 1000,
        height: 1000,
        count: 1,
        sections: 1,
        opening: 'doner',
        profileUnit: 'm',
        profileRate: 10,
        glassRate: 20,
        hardwareRate: 5,
        laborRate: 4,
        installRate: 0,
        packRate: 1,
        transport: 2,
        extra: 0,
        vat: 18,
        profit: 10,
        profitMode: 'faiz',
        glassConfirmed: false,
        installKind: '',
      },
      { ...rule, confirmed: false },
    );
    expect(open.sale).toBeNull();
    const closed = windowMath(
      {
        width: 1000,
        height: 1000,
        count: 1,
        sections: 1,
        opening: 'sabit',
        profileUnit: 'm',
        profileRate: 10,
        glassRate: 20,
        hardwareRate: 5,
        laborRate: 4,
        installRate: 0,
        packRate: 1,
        transport: 2,
        extra: 0,
        vat: 18,
        profit: 10,
        profitMode: 'faiz',
        glassConfirmed: false,
        installKind: '',
      },
      rule,
    );
    expect(closed.cost).not.toBeNull();
    expect(closed.gross).not.toBeNull();
  });

  it('smeta fərqini və mənfəəti hesablayır', () => {
    const totals = boqTotals({
      lines: [{ qty: 2, material: 100, labor: 50 }],
      costs: [{ amount: 30 }],
      gearInsurance: 20,
      profit: 10,
      profitMode: 'faiz',
      vat: 18,
    });
    expect(totals.base).toBe(350);
    expect(totals.sale).toBe(385);
    const gap = variance(200000, 235000);
    expect(gap.diff).toBe(35000);
    expect(gap.percent).toBeCloseTo(17.5);
  });

  it('anbarı mənfiyə salmır və köhnə qiyməti aktual saymır', () => {
    expect(issueStock(3, 4).ok).toBe(false);
    expect(fifoIssue([{ id: 'a', qty: 1, at: 1 }, { id: 'b', qty: 2, at: 2 }], 2).taken).toEqual([
      { id: 'a', qty: 1 },
      { id: 'b', qty: 1 },
    ]);
    expect(isStale(new Date('2020-01-01'), new Date('2026-10-12'))).toBe(true);
    expect(isStale(null, new Date())).toBe(false);
  });

  it('ən aşağı qiyməti tək qalib saymır və tender müddətini bildirir', () => {
    const compared = compareBids([
      { id: '1', unitPrice: 10, leadDays: 30, quality: '', delivery: null },
      { id: '2', unitPrice: 12, leadDays: 2, quality: 'sertifikat', delivery: 5 },
    ]);
    const first = compared.rows.find((row) => row.id === '1');
    const second = compared.rows.find((row) => row.id === '2');
    expect((second?.score ?? 0) > (first?.score ?? 0)).toBe(true);
    const soon = new Date('2026-10-13T12:00:00Z');
    expect(tenderAlerts(soon, new Date('2026-10-12T12:00:00Z'))).toContain(
      'Tenderin bitməsinə 24 saat qalıb',
    );
  });

  it('hava dayanması, təsdiqli staj və yaşıl işıq sənədsiz açılmır', () => {
    const stops = weatherStops(
      [{ rainAt: 80, windAt: null, pouring: false, stops: 'dam', active: true }],
      { rainPercent: 80, windMs: 2, pouring: false },
    );
    expect(stops).toEqual(['dam']);
    expect(confirmedYears([{ years: 5, confirmed: false }, { years: 2, confirmed: true }])).toBe(2);
    expect(greenPartner('', new Date())).toBe(false);
    expect(greenPartner('məktub', new Date())).toBe(true);
    expect(guaranteeAmount('percent', 1000, 2).amount).toBe(20);
  });

  it('cədvəli oxuyur, skanı isə təsdiqsiz saxlayır', () => {
    const rows = parseTable('ad;miqdar;vahid\nFasad;500;m2');
    expect(rows[0].name).toBe('Fasad');
    expect(rows[0].qty).toBe('500');
    const dwg = scanUpload('plan.dwg', '');
    expect(dwg.rows[0].flags).toContain('oxunmadi');
    expect(dwg.rows[0].confirmed).toBe(false);
    expect(scanUpload('bad.exe', 'x').scan).toBe('redd');
  });
});
