import {Body,Controller,Get,Param,Post,Query,Req} from '@nestjs/common';
import {AuthUser} from '../auth/auth.service';
import {Public} from '../auth/public.decorator';
import {TenantService} from './tenant.service';
import {MarketService} from './market.service';
import {NotificationScheduler} from './notification-scheduler';
type RequestUser={user:AuthUser};
@Controller('market')
export class MarketController{
 constructor(private readonly market:MarketService,private readonly tenant:TenantService,private readonly scheduler:NotificationScheduler){}
 private ctx(req:RequestUser){return this.tenant.load(req.user);}
 @Get('notifications/status') async notificationStatus(@Req()req:RequestUser){this.tenant.admin(await this.ctx(req));return this.scheduler.status();}
 @Post('notifications/run') async notificationRun(@Req()req:RequestUser){this.tenant.admin(await this.ctx(req));return this.scheduler.run();}
 @Get('workspace') async workspace(@Req()req:RequestUser){return this.market.workspace(await this.ctx(req));}
 @Public() @Get('catalog') catalog(@Query('q')q='',@Query('category')category='',@Query('region')region=''){return this.market.catalog(q,category,region);}
 @Get('company') async company(@Req()req:RequestUser){return this.market.myCompany(await this.ctx(req));}
 @Post('company') async register(@Req()req:RequestUser,@Body()body:Record<string,unknown>){return this.market.registerCompany(await this.ctx(req),body);}
 @Get('moderation') async moderation(@Req()req:RequestUser){return this.market.moderation(await this.ctx(req));}
 @Post('moderation/:kind/:id') async moderate(@Req()req:RequestUser,@Param('kind')kind:string,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.moderate(await this.ctx(req),kind,id,body);}
 @Post('items') async propose(@Req()req:RequestUser,@Body()body:Record<string,unknown>){return this.market.proposeItem(await this.ctx(req),body);}
 @Post('items/:id/listing') async listing(@Req()req:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.listing(await this.ctx(req),id,body);}
 @Get('cases') async cases(@Req()req:RequestUser,@Query('kind')kind:string){return this.market.cases(await this.ctx(req),kind);}
 @Get('cases/:id') async detail(@Req()req:RequestUser,@Param('id')id:string){return this.market.detail(await this.ctx(req),id);}
 @Get('cases/:id/events') async events(@Req()req:RequestUser,@Param('id')id:string){return this.market.events(await this.ctx(req),id);}
 @Post('rfqs') async rfq(@Req()req:RequestUser,@Body()body:Record<string,unknown>){return this.market.createRfq(await this.ctx(req),body);}
 @Post('rfqs/:id/bids') async bid(@Req()req:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.bid(await this.ctx(req),id,body);}
 @Post('rfqs/:id/bids/:bidId/select') async select(@Req()req:RequestUser,@Param('id')id:string,@Param('bidId')bidId:string,@Body()body:Record<string,unknown>){return this.market.selectBid(await this.ctx(req),id,bidId,body);}
 @Post('orders/:id/confirm') async confirm(@Req()req:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.confirmOrder(await this.ctx(req),id,body);}
 @Post('orders/:id/deliveries') async deliver(@Req()req:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.deliver(await this.ctx(req),id,body);}
 @Post('orders/:id/receipts') async receipt(@Req()req:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.receive(await this.ctx(req),id,body);}
 @Post('orders/:id/erp') async erp(@Req()req:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.linkErp(await this.ctx(req),id,body);}
 @Post('orders/:id/tariffs') async reconcile(@Req()req:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.reconcileTariffs(await this.ctx(req),id,body);}
 @Post('cases/:id/messages') async message(@Req()req:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.message(await this.ctx(req),id,body);}
 @Post('acceptance-grants') async grant(@Req()req:RequestUser,@Body()body:Record<string,unknown>){return this.market.grantAcceptance(await this.ctx(req),body);}
 @Get('finance') async finance(@Req()req:RequestUser,@Query('month')month:string){return this.market.finance(await this.ctx(req),month);}
 @Post('charges/:id/payments') async payment(@Req()req:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.submitPayment(await this.ctx(req),id,body);}
 @Post('payments/:id/review') async review(@Req()req:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.reviewPayment(await this.ctx(req),id,body);}
 @Get('settings') async settings(@Req()req:RequestUser){return this.market.settings(await this.ctx(req));}
 @Post('tariffs') async tariff(@Req()req:RequestUser,@Body()body:Record<string,unknown>){return this.market.saveTariff(await this.ctx(req),body);}
 @Post('policy') async policy(@Req()req:RequestUser,@Body()body:Record<string,unknown>){return this.market.savePolicy(await this.ctx(req),body);}
 @Post('reminders') async reminders(@Req()req:RequestUser){return this.market.reminders(await this.ctx(req));}
 @Post('orders/:id/disputes/:disputeId/recommend') async recommend(@Req()req:RequestUser,@Param('id')id:string,@Param('disputeId')disputeId:string,@Body()body:Record<string,unknown>){return this.market.recommendDispute(await this.ctx(req),id,disputeId,body);}
 @Post('orders/:id/disputes/:disputeId/resolve') async resolve(@Req()req:RequestUser,@Param('id')id:string,@Param('disputeId')disputeId:string,@Body()body:Record<string,unknown>){return this.market.resolveDispute(await this.ctx(req),id,disputeId,body);}
 @Post('orders/:id/returns') async requestReturn(@Req()req:RequestUser,@Param('id')id:string,@Body()body:Record<string,unknown>){return this.market.requestReturn(await this.ctx(req),id,body);}
 @Post('orders/:id/returns/:returnId/confirm') async confirmReturn(@Req()req:RequestUser,@Param('id')id:string,@Param('returnId')returnId:string,@Body()body:Record<string,unknown>){return this.market.confirmReturn(await this.ctx(req),id,returnId,body);}
}
