import { certAlerts, readTenderBrief, scoreChecks, tenderLetter, type CompanyFacts } from './tender-brief';

const empty: CompanyFacts = {
  named: true,
  voen: true,
  permits: true,
  turnover: true,
  pastWork: true,
  hasAct: true,
  engineerDiploma: true,
  engineerYears: 6,
  engineerConfirmed: true,
  workerYears: 8,
  workerConfirmed: true,
  gear: [{ name: 'Ekskavator', documented: true }, { name: 'Avtokran 25t', documented: true }],
  hasQuality: true,
  hasBoq: true,
  hasSchedule: true,
  hasBidBond: true,
  hasPerformBond: true,
};

describe('tender brief', () => {
  const text = [
    'Podratçının oxşar iş təcrübəsi ən azı 5 il olmalıdır.',
    'Mühəndisin iş stajı 5 il tələb olunur.',
    'Texnika: ekskavator və avtokran.',
    'Təqdim edilməli sənədlər:',
    'VÖEN arayışı',
    'Maliyyə hesabatı',
    'Cərimə müqavilə dəyərinin 10 faizidir.',
    'Ekvivalent qəbul edilmir.',
  ].join('\n');

  it('təcrübə, staj, texnika və sənədi mətndən çıxarır', () => {
    const brief = readTenderBrief(text);
    expect(brief.companyYears).toBe(5);
    expect(brief.engineerYears).toBe(5);
    expect(brief.gear).toEqual(expect.arrayContaining(['ekskavator', 'avtokran']));
    expect(brief.papers.some((item) => item.includes('VÖEN'))).toBe(true);
    expect(brief.risks.length).toBeGreaterThan(0);
    expect(brief.summary).toContain('5 il');
  });

  it('boş mətndə tələbi uydurmur', () => {
    const brief = readTenderBrief('Ümumi məlumat.');
    expect(brief.companyYears).toBeNull();
    expect(brief.gear).toEqual([]);
    const worker = scoreChecks(brief, empty).find((row) => row.name === 'İşçi təcrübəsi');
    const gear = scoreChecks(brief, empty).find((row) => row.name === 'Texnika sənədi');
    expect(worker?.fit).toBe('el');
    expect(gear?.fit).toBe('el');
  });

  it('təsdiqli staj və texnika uyğun, çatışmayan sənəd uyğun deyil', () => {
    const brief = readTenderBrief(text);
    const ready = scoreChecks(brief, empty);
    expect(ready.find((row) => row.name === 'İşçi təcrübəsi')?.fit).toBe('uygun');
    expect(ready.find((row) => row.name === 'Texnika sənədi')?.fit).toBe('uygun');
    const short = scoreChecks(brief, { ...empty, workerYears: 2, workerConfirmed: true, gear: [] });
    expect(short.find((row) => row.name === 'İşçi təcrübəsi')?.fit).toBe('deyil');
    expect(short.find((row) => row.name === 'Texnika sənədi')?.fit).toBe('catismir');
  });

  it('sertifikat müddətini və e-poçt mətnini yazır', () => {
    const today = new Date('2026-10-14T00:00:00Z');
    const alerts = certAlerts(
      [
        { material: 'Sement', certificate: 'S-1', validUntil: new Date('2026-10-20T00:00:00Z') },
        { material: 'Qum', certificate: 'Q-1', validUntil: new Date('2027-06-01T00:00:00Z') },
      ],
      today,
    );
    expect(alerts).toEqual(['Sertifikatın müddəti bitir: Sement']);
    const letter = tenderLetter({ to: 'ofis@afez.az', number: 'ET-1', subject: 'Məktəb', lines: alerts });
    expect(letter).toContain('ofis@afez.az');
    expect(letter).toContain('Poçt xidməti bağlanmayıb');
  });
});
