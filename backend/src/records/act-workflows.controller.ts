import {Body,Controller,Get,Param,Post,Req} from '@nestjs/common';
import {AuthUser} from '../auth/auth.service';
import {ActWorkflowsService} from './act-workflows.service';
@Controller('act-workflows')
export class ActWorkflowsController{
 constructor(private readonly workflows:ActWorkflowsService){}
 @Post(':id/approve-daily') approveDaily(@Req()req:{user:AuthUser},@Param('id')id:string,@Body()body:Record<string,unknown>){return this.workflows.daily(req.user,id,body,false);}
 @Post(':id/measure-daily') measureDaily(@Req()req:{user:AuthUser},@Param('id')id:string,@Body()body:Record<string,unknown>){return this.workflows.daily(req.user,id,body,true);}
 @Post(':id/return-invoice') returnInvoice(@Req()req:{user:AuthUser},@Param('id')id:string,@Body()body:Record<string,unknown>){return this.workflows.reverseInvoice(req.user,id,body);}
 @Post(':id/return-f2') returnF2(@Req()req:{user:AuthUser},@Param('id')id:string,@Body()body:Record<string,unknown>){return this.workflows.returnF2(req.user,id,body);}
 @Post(':id/approve-f3') approveF3(@Req()req:{user:AuthUser},@Param('id')id:string,@Body()body:Record<string,unknown>){return this.workflows.transitionF3(req.user,id,body,true);}
 @Post(':id/return-f3') returnF3(@Req()req:{user:AuthUser},@Param('id')id:string,@Body()body:Record<string,unknown>){return this.workflows.transitionF3(req.user,id,body,false);}
 @Post(':id/return-purchase') returnPurchase(@Req()req:{user:AuthUser},@Param('id')id:string,@Body()body:Record<string,unknown>){return this.workflows.reversePurchase(req.user,id,body);}
 @Post(':id/approve-f2') approve(@Req()req:{user:AuthUser},@Param('id')id:string,@Body()body:Record<string,unknown>){return this.workflows.approveF2(req.user,id,body.key);}
 @Post(':id/receive-purchase') receive(@Req()req:{user:AuthUser},@Param('id')id:string,@Body()body:Record<string,unknown>){return this.workflows.receivePurchase(req.user,id,body);}
 @Get(':id/purchase-receipts') receipts(@Req()req:{user:AuthUser},@Param('id')id:string){return this.workflows.purchaseReceipts(req.user,id);}
 @Get(':id/purchase-dispute-resolutions') disputeResolutions(@Req()req:{user:AuthUser},@Param('id')id:string){return this.workflows.purchaseDisputeResolutions(req.user,id);}
 @Get('purchase-supplier-reconciliation') supplierReconciliation(@Req()req:{user:AuthUser}){return this.workflows.purchaseSupplierReconciliation(req.user);}
 @Post(':id/request-purchase-dispute-resolution') requestDisputeResolution(@Req()req:{user:AuthUser},@Param('id')id:string,@Body()body:Record<string,unknown>){return this.workflows.requestPurchaseDisputeResolution(req.user,id,body);}
 @Post(':id/review-purchase-dispute-resolution') reviewDisputeResolution(@Req()req:{user:AuthUser},@Param('id')id:string,@Body()body:Record<string,unknown>){return this.workflows.reviewPurchaseDisputeResolution(req.user,id,body);}
}
