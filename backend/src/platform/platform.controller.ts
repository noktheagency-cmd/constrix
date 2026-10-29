import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth.service';
import { PlatformService } from './platform.service';
import { TenantService } from './tenant.service';

type RequestUser = { user: AuthUser };

@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly tenant: TenantService,
  ) {}

  private async ctx(request: RequestUser) {
    return this.tenant.load(request.user);
  }

  @Get('source-workbooks')
  async sourceBooks(@Req() request: RequestUser, @Query('kind') kind: string) {
    return this.platform.sourceBooks(await this.ctx(request), kind);
  }

  @Get('source-sheets/:id')
  async sourceRows(@Req() request: RequestUser, @Param('id') id: string, @Query('page') page: string, @Query('q') query: string, @Query('pageSize') pageSize: string) {
    return this.platform.sourceRows(await this.ctx(request), id, page, query, pageSize);
  }

  @Get('source-workbooks/:id/download')
  async sourceOriginal(@Req() request: RequestUser, @Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    const book = await this.platform.sourceOriginal(await this.ctx(request), id);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(book.name)}`);
    return new StreamableFile(Buffer.from(book.original));
  }
  @Post('source-workbooks/:id/prices')
  async sourcePrices(@Req()request:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>,@Res({passthrough:true})response:Response){
    const result=await this.platform.sourcePrices(await this.ctx(request),id,String(body.boqId||''));response.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');response.setHeader('Cache-Control','private, no-store');response.setHeader('X-Export-Rows',String(result.rows));response.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(result.name)}`);return new StreamableFile(result.bytes);
  }

  @Get('meta')
  meta() {
    return this.platform.meta();
  }

  @Get('me')
  async me(@Req() request: RequestUser) {
    return this.platform.me(await this.ctx(request));
  }

  @Get('organizations')
  async organizations(@Req() request: RequestUser) {
    return this.platform.listOrganizations(await this.ctx(request));
  }

  @Post('organizations/select')
  async selectOrganization(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.selectOrganization(await this.ctx(request), body);
  }

  @Post('organizations/secrets')
  async secrets(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.revealSecrets(await this.ctx(request), body);
  }

  @Post('organizations')
  async register(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.register(await this.ctx(request), body);
  }

  @Get('people')
  async people(@Req() request: RequestUser) {
    return this.platform.orgPeople(await this.ctx(request));
  }

  @Get('people/:id')
  async person(@Req() request: RequestUser, @Param('id') id: string) {
    return this.platform.orgPerson(await this.ctx(request), id);
  }

  @Patch('organizations/current')
  async updateOrg(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.updateOrg(await this.ctx(request), body);
  }

  @Post('members')
  async addMember(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.addMember(await this.ctx(request), body);
  }

  @Get('packages')
  packages() {
    return this.platform.packages();
  }

  @Patch('packages/:id')
  async editPackage(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.editPackage(await this.ctx(request), id, body);
  }

  @Get('subscription/state')
  async subscriptionState(@Req() request: RequestUser) {
    return this.platform.subscriptionState(await this.ctx(request));
  }

  @Post('subscription')
  async choose(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.choosePackage(await this.ctx(request), body);
  }

  @Post('subscription/payment')
  async pay(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.notePayment(await this.ctx(request), body);
  }

  @Get('cabinet')
  async cabinet(@Req() request: RequestUser) {
    return this.platform.cabinet(await this.ctx(request));
  }

  @Post('products')
  async saveProduct(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveProduct(await this.ctx(request), body);
  }

  @Patch('products/:id')
  async editProduct(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.saveProduct(await this.ctx(request), body, id);
  }

  @Get('market/products')
  async market(@Req() request: RequestUser, @Query('category') category = '') {
    return this.platform.market(await this.ctx(request), category);
  }

  @Get('market/rfqs')
  async marketRfqs(@Req() request: RequestUser) {
    return this.platform.marketRfqs(await this.ctx(request));
  }

  @Post('market/products/:id/price')
  async quote(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.quoteProduct(await this.ctx(request), id, body);
  }

  @Get('standards')
  standards() {
    return this.platform.standards();
  }

  @Post('files/parse')
  async parse(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.parseFile(await this.ctx(request), body);
  }

  @Patch('files/rows/:id')
  async confirm(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.confirmRow(await this.ctx(request), id, body);
  }

  @Post('calc/preview')
  async previewCalc(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.previewCalc(await this.ctx(request), body);
  }

  @Get('jobs')
  async listJobs(@Req() request: RequestUser) {
    return this.platform.listJobs(await this.ctx(request));
  }

  @Post('jobs')
  async saveJob(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveJob(await this.ctx(request), body);
  }

  @Get('rules')
  async listRules(@Req() request: RequestUser) {
    return this.platform.listRules(await this.ctx(request));
  }

  @Post('rules')
  async saveRule(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveRule(await this.ctx(request), body);
  }

  @Get('haul')
  async listHauls(@Req() request: RequestUser) {
    return this.platform.listHauls(await this.ctx(request));
  }

  @Post('haul/preview')
  async previewHaul(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.previewHaul(await this.ctx(request), body);
  }

  @Post('haul')
  async saveHaul(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveHaul(await this.ctx(request), body);
  }

  @Get('flows')
  async listFlows(@Req() request: RequestUser) {
    return this.platform.listFlows(await this.ctx(request));
  }

  @Post('flows')
  async openFlow(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.openFlow(await this.ctx(request), body);
  }

  @Post('flows/:id/advance')
  async advance(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.advanceFlow(await this.ctx(request), id, body);
  }

  @Get('tenders')
  async listTenders(@Req() request: RequestUser) {
    return this.platform.listTenders(await this.ctx(request));
  }

  @Post('tenders')
  async saveTender(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveTender(await this.ctx(request), body);
  }

  @Patch('tenders/:id')
  async updateTender(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.updateTender(await this.ctx(request), id, body);
  }

  @Post('tenders/:id/refresh')
  async refresh(@Req() request: RequestUser, @Param('id') id: string) {
    return this.platform.refreshTender(await this.ctx(request), id);
  }

  @Post('tenders/:id/read')
  async readTender(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.readTender(await this.ctx(request), id, body);
  }

  @Get('tenders/:id/analyses')
  async tenderAnalyses(@Req() request: RequestUser,@Param('id') id:string){return this.platform.tenderAnalyses(await this.ctx(request),id);}

  @Post('tenders/:id/approval-config')
  async configureTender(@Req() request:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.platform.tenderApprovalConfig(await this.ctx(request),id,body);}

  @Get('tenders/:id/approval-state')
  async approvalState(@Req()request:RequestUser,@Param('id')id:string){return this.platform.tenderApprovalState(await this.ctx(request),id);}

  @Post('tenders/:id/approvals/:approvalId/sign')
  async signTender(@Req()request:RequestUser,@Param('id')id:string,@Param('approvalId')approvalId:string,@Body()body:Record<string,unknown>){return this.platform.signTenderDocument(await this.ctx(request),id,approvalId,body);}

  @Post('tenders/:id/submission')
  async submitTender(@Req()request:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.platform.recordTenderSubmission(await this.ctx(request),id,body);}

  @Post('tenders/:id/analyses/:analysisId/review')
  async reviewTender(@Req() request:RequestUser,@Param('id') id:string,@Param('analysisId') analysisId:string,@Body() body:Record<string,unknown>){return this.platform.reviewTenderAnalysis(await this.ctx(request),id,analysisId,body);}

  @Post('tenders/:id/analyses/:analysisId/compare')
  async compareTender(@Req() request:RequestUser,@Param('id') id:string,@Param('analysisId') analysisId:string){return this.platform.compareTenderAnalysis(await this.ctx(request),id,analysisId);}

  @Get('boq')
  async listBoq(@Req() request: RequestUser) {
    return this.platform.listBoq(await this.ctx(request));
  }

  @Post('boq')
  async saveBoq(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveBoq(await this.ctx(request), body);
  }

  @Get('boq/:id')
  async boq(@Req() request: RequestUser, @Param('id') id: string) {
    return this.platform.boqResult(await this.ctx(request), id);
  }

  @Post('inquiries')
  async inquiry(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.createInquiry(await this.ctx(request), body);
  }

  @Get('inquiries/incoming')
  async incoming(@Req() request: RequestUser) {
    return this.platform.incomingInquiries(await this.ctx(request));
  }

  @Post('inquiries/:id/bids')
  async bid(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.placeBid(await this.ctx(request), id, body);
  }

  @Get('inquiries/:id/compare')
  async compare(@Req() request: RequestUser, @Param('id') id: string) {
    return this.platform.compareInquiry(await this.ctx(request), id);
  }

  @Post('bids/:id/select')
  async select(@Req() request: RequestUser, @Param('id') id: string) {
    return this.platform.selectBid(await this.ctx(request), id);
  }

  @Get('lots')
  async lots(@Req() request: RequestUser) {
    return this.platform.listLots(await this.ctx(request));
  }

  @Post('warehouse/policy')
  async stockMethod(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.setStockMethod(await this.ctx(request), body);
  }

  @Post('lots/act')
  async stockAct(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.stockAct(await this.ctx(request), body);
  }

  @Post('lots')
  async receive(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.receiveLot(await this.ctx(request), body);
  }

  @Post('lots/issue')
  async issue(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.issueLot(await this.ctx(request), body);
  }

  @Get('lots/qr/:qr')
  async qr(@Req() request: RequestUser, @Param('qr') qr: string) {
    return this.platform.lotByQr(await this.ctx(request), qr);
  }

  @Get('talent')
  async listTalent(@Req() request: RequestUser) {
    return this.platform.listTalent(await this.ctx(request));
  }

  @Post('talent')
  async talent(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveTalent(await this.ctx(request), body);
  }

  @Post('talent/:id/proofs')
  async proof(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.addProof(await this.ctx(request), id, body);
  }

  @Post('talent/search')
  async search(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.searchTalent(await this.ctx(request), body);
  }

  @Get('openings')
  async listOpenings(@Req() request: RequestUser) {
    return this.platform.listOpenings(await this.ctx(request));
  }

  @Post('openings')
  async opening(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveOpening(await this.ctx(request), body);
  }

  @Post('labor-rates')
  async labor(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveTariff(await this.ctx(request), body);
  }

  @Post('machine-rates')
  async machine(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveMachine(await this.ctx(request), body);
  }

  @Post('rentals')
  async rental(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveRental(await this.ctx(request), body);
  }

  @Get('market/rentals')
  async marketRentals(@Req() request: RequestUser) {
    return this.platform.marketRentals(await this.ctx(request));
  }

  @Post('approvals')
  async chain(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.openChain(await this.ctx(request), body);
  }

  @Post('approvals/steps/:id')
  async step(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.actStep(await this.ctx(request), id, body);
  }

  @Get('projects')
  async listProjects(@Req() request: RequestUser) {
    return this.platform.listProjects(await this.ctx(request));
  }

  @Post('projects')
  async project(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.project(await this.ctx(request), body);
  }

  @Get('projects/:id/finance')
  async finance(@Req() request: RequestUser, @Param('id') id: string) {
    return this.platform.projectFinance(await this.ctx(request), id);
  }

  @Post('cash')
  async cash(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveCash(await this.ctx(request), body);
  }

  @Get('schedules')
  async schedules(@Req() request: RequestUser) {
    return this.platform.listSchedules(await this.ctx(request));
  }

  @Post('schedules')
  async schedule(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveSchedule(await this.ctx(request), body);
  }

  @Post('weather')
  async weather(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.recordWeather(await this.ctx(request), body);
  }

  @Get('safety-rules')
  async rules(@Req() request: RequestUser) {
    return this.platform.safetyRules(await this.ctx(request));
  }

  @Get('finance/partners')
  async partners(@Req() request: RequestUser) {
    return this.platform.financePartners(await this.ctx(request));
  }

  @Post('finance/partners')
  async savePartner(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.savePartner(await this.ctx(request), body);
  }

  @Patch('finance/partners/:id')
  async updatePartner(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.updatePartner(await this.ctx(request), id, body);
  }

  @Post('finance/products')
  async product(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveFinanceProduct(await this.ctx(request), body);
  }

  @Get('finance/products/compare')
  async compareProducts(@Req() request: RequestUser, @Query('line') line = '') {
    return this.platform.compareProducts(await this.ctx(request), line);
  }

  @Get('finance/applications')
  async listApplications(@Req() request: RequestUser) {
    return this.platform.listApplications(await this.ctx(request));
  }

  @Post('finance/applications')
  async application(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.openApplication(await this.ctx(request), body);
  }

  @Post('finance/applications/:id/status')
  async appStatus(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.applicationStatus(await this.ctx(request), id, body);
  }

  @Get('finance/guarantees')
  async listGuarantees(@Req() request: RequestUser) {
    return this.platform.listGuarantees(await this.ctx(request));
  }

  @Post('finance/guarantees')
  async guarantee(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.guaranteePack(await this.ctx(request), body);
  }

  @Get('official-checks')
  async listInquiries(@Req() request: RequestUser) {
    return this.platform.listInquiries(await this.ctx(request));
  }

  @Post('official-checks')
  async official(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.officialCheck(await this.ctx(request), body);
  }

  @Get('passports')
  async listPassports(@Req() request: RequestUser) {
    return this.platform.listPassports(await this.ctx(request));
  }

  @Post('passports')
  async passport(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.savePassport(await this.ctx(request), body);
  }

  @Post('passports/:id/match')
  async match(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.matchPassport(await this.ctx(request), id, body);
  }

  @Post('defects')
  async defect(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.defect(await this.ctx(request), body);
  }

  @Post('incidents')
  async incident(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.incident(await this.ctx(request), body);
  }

  @Post('photos')
  async photo(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.photo(await this.ctx(request), body);
  }

  @Get('templates')
  async listTemplates(@Req() request: RequestUser) {
    return this.platform.listTemplates(await this.ctx(request));
  }

  @Post('templates')
  async template(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveTemplate(await this.ctx(request), body);
  }

  @Patch('templates/:id')
  async updateTemplate(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.updateTemplate(await this.ctx(request), id, body);
  }

  @Post('templates/:id/render')
  async render(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.renderTemplate(await this.ctx(request), id, body);
  }

  @Get('tax-rules')
  async taxes(@Req() request: RequestUser) {
    return this.platform.taxRules(await this.ctx(request));
  }

  @Post('tax-rules')
  async saveTax(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.saveTaxRule(await this.ctx(request), body);
  }

  @Post('tax-rules/explain')
  async explain(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.explainTax(await this.ctx(request), body);
  }

  @Get('coop')
  async listCoop(@Req() request: RequestUser) {
    return this.platform.listCoop(await this.ctx(request));
  }

  @Post('coop')
  async coop(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.coop(await this.ctx(request), body);
  }

  @Post('coop/:id/findings')
  async finding(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.coopFinding(await this.ctx(request), id, body);
  }

  @Post('payroll/preview')
  async payroll(@Req() request: RequestUser, @Body() body: Record<string, unknown>) {
    return this.platform.payPreview(await this.ctx(request), body);
  }

  @Get('notices')
  async notices(@Req() request: RequestUser) {
    return this.platform.notices(await this.ctx(request));
  }

  @Get('admin/summary')
  async summary(@Req() request: RequestUser) {
    return this.platform.adminSummary(await this.ctx(request));
  }

  @Post('admin/support/:id')
  async support(
    @Req() request: RequestUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.supportLook(await this.ctx(request), id, String(body.reason ?? ''));
  }
}
