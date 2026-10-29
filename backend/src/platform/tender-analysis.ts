import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readTenderBrief, type TenderBrief } from './tender-brief';

export function extractTender(sourceText: string, sourceName: string) {
  if (sourceText.trim().length < 20 || sourceText.length > 2_000_000) throw new BadRequestException('Mətn 20–2 000 000 simvol olmalıdır.');
  const brief = readTenderBrief(sourceText);
  const evidence = sourceText.split('\f').flatMap((page, index) => page.split(/\r?\n/).map((line, lineIndex) => ({ page: sourceText.includes('\f') ? index + 1 : null, paragraph: lineIndex + 1, excerpt: line.trim() })).filter(row => row.excerpt && /il\b|mühəndis|muhendis|zəmanət|zemanet|ekskavator|kran|sənəd|sened|lisenziya|maliyyə|sertifikat|BOQ|smeta|işçi|təcrübə/i.test(row.excerpt)).map(row => ({ ...row, sourceName, confidence: null, method: 'qayda əsaslı çıxarış' })));
  return { brief, evidence, sourceHash: createHash('sha256').update(sourceText).digest('hex') };
}

export function reviewedBrief(input: unknown): TenderBrief {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Tələb xülasəsi düzgün deyil.');
  const row = input as Record<string, unknown>;
  const years = (value: unknown) => {
    if (value == null || value === '') return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 150) throw new BadRequestException('Təcrübə ili düzgün deyil.');
    return value;
  };
  const strings = (value: unknown) => {
    if (!Array.isArray(value) || value.length > 200 || value.some(v => typeof v !== 'string' || v.length > 4000)) throw new BadRequestException('Tələb siyahısı düzgün deyil.');
    return value as string[];
  };
  return { companyYears: years(row.companyYears), engineerYears: years(row.engineerYears), gear: strings(row.gear), papers: strings(row.papers), risks: strings(row.risks), summary: String(row.summary || '').slice(0, 4000) };
}
