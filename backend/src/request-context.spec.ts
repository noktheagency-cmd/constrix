import { BadRequestException } from '@nestjs/common';
import { RequestContextMiddleware, RequestExceptionFilter } from './request-context';
describe('request tracing', () => {
 it('generates an independent trace ID and returns it in errors without leaking internal errors', () => {
  const req:any = { method:'GET', headers:{'x-request-id':'attacker\nlog'} }, res:any = {setHeader:jest.fn(),status:jest.fn().mockReturnThis(),json:jest.fn()}, next=jest.fn();
  new RequestContextMiddleware().use(req,res,next);
  expect(req.requestId).toMatch(/^[a-f0-9-]{36}$/);expect(next).toHaveBeenCalledTimes(1);
  const host:any={switchToHttp:()=>({getRequest:()=>req,getResponse:()=>res})};
  new RequestExceptionFilter().catch(new Error('secret database URL'),host);
  expect(res.json.mock.calls[0][0]).toMatchObject({statusCode:500,requestId:req.requestId});expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret');
  new RequestExceptionFilter().catch(new BadRequestException(['Miqdar düzgün deyil']),host);
  expect(res.json.mock.calls[1][0].message).toEqual(['Miqdar düzgün deyil']);
 });
});
