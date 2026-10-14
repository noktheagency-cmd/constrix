import { buildPhaseProcedures } from './phase-procedures';

const phases = ['Torpaq', 'Bünövrə', 'Karkas', 'Fasad', 'Tamamlama', 'Təhvil'].map(
  (name, sort) => ({
    name,
    sort,
    done: sort < 4,
    current: name === 'Tamamlama',
  }),
);

describe('buildPhaseProcedures', () => {
  const rows = buildPhaseProcedures(
    {
      id: 'seed-prj-villa',
      phase: 'Tamamlama',
      progress: 91,
      budget: 7800000,
      start: '2025-01-20',
      phases,
    },
    new Date('2026-10-14T00:00:00Z'),
  );

  it('tamamlanan mərhələnin prosedurlarını tam həcmlə yazır', () => {
    const done = rows.filter((item) => item.phase === 'Fasad');
    expect(done.length).toBeGreaterThan(0);
    expect(done.every((item) => item.doneQty === item.qty && item.doneOn)).toBe(
      true,
    );
  });

  it('cari mərhələdə qalan həcm saxlayır', () => {
    const open = rows.filter((item) => item.phase === 'Tamamlama');
    expect(open.every((item) => item.doneQty > 0 && item.doneQty < item.qty)).toBe(
      true,
    );
  });

  it('açılmamış mərhələni plansız həcm kimi saxlayır', () => {
    const later = rows.filter((item) => item.phase === 'Təhvil');
    expect(later.every((item) => item.doneQty === 0 && item.doneOn === '')).toBe(
      true,
    );
  });
});
