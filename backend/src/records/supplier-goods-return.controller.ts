import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { SupplierGoodsReturnService } from './supplier-goods-return.service';

@Controller('supplier-goods-returns')
export class SupplierGoodsReturnController {
  constructor(private readonly returns: SupplierGoodsReturnService) {}
  @Get('eligible') eligible(@Req() req: { user: AuthUser }) { return this.returns.eligible(req.user); }
  @Get() list(@Req() req: { user: AuthUser }) { return this.returns.list(req.user); }
  @Post() create(@Req() req: { user: AuthUser }, @Body() body: Record<string, unknown>) { return this.returns.create(req.user, body); }
  @Post(':id/approve') approve(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.returns.approve(req.user, id, body); }
  @Post(':id/dispatch') dispatch(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.returns.dispatch(req.user, id, body); }
  @Post(':id/supplier-confirm') confirmSupplier(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.returns.confirmSupplier(req.user, id, body); }
  @Post(':id/finance-review') finance(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.returns.finance(req.user, id, body); }
}
