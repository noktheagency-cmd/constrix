import { BadRequestException } from '@nestjs/common';
import { extractTender, reviewedBrief } from './tender-analysis';
import { PlatformService } from './platform.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantCtx,TenantService } from './tenant.service';

describe('human-reviewed tender analysis',()=>{
 it('retains exact excerpts without inventing a PDF page',()=>{
  const result=extractTender('Tender şərtləri\nMühəndis ən azı 5 il təcrübəli olmalıdır.','şərt.docx');
  expect(result.evidence[0]).toEqual(expect.objectContaining({excerpt:'Mühəndis ən azı 5 il təcrübəli olmalıdır.',page:null,paragraph:2,sourceName:'şərt.docx',confidence:null}));
  expect(result.sourceHash).toHaveLength(64);
 });
 it('tracks explicit page boundaries and validates manual edits',()=>{
  const result=extractTender('Tender şərtləri səhifəsi\f2 ekskavator və zəmanət tələb olunur','tender.pdf');
  expect(result.evidence.find(e=>e.excerpt.includes('ekskavator'))?.page).toBe(2);
  expect(()=>reviewedBrief({...result.brief,engineerYears:-1})).toThrow(BadRequestException);
 });
 it('does not read company facts or score before human approval',async()=>{
  const db={tenderCase:{findFirst:jest.fn().mockResolvedValue({id:'t'})},tenderAnalysis:{findFirst:jest.fn().mockResolvedValue({id:'v1',confirmedAt:null})},organization:{findUnique:jest.fn()}};
  const service=new PlatformService(db as unknown as PrismaService,{allow:jest.fn()} as unknown as TenantService);
  await expect(service.compareTenderAnalysis({orgId:'a'} as TenantCtx,'t','v1')).rejects.toThrow(BadRequestException);
  expect(db.organization.findUnique).not.toHaveBeenCalled();
 });
 it('rejects confirmation of superseded versions',async()=>{
  const tx={tenderAnalysis:{findFirst:jest.fn().mockResolvedValue({id:'v2'})}};
  const db={$transaction:jest.fn(async fn=>fn(tx))};
  const service=new PlatformService(db as unknown as PrismaService,{allow:jest.fn(),own:jest.fn()} as unknown as TenantService);
  await expect(service.reviewTenderAnalysis({orgId:'a'} as TenantCtx,'t','v1',{brief:extractTender('Tender sənədində 2 ekskavator tələb olunur','t').brief})).rejects.toThrow(BadRequestException);
 });
});
