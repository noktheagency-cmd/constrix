import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService, AuthUser } from './auth.service';
import { LoginDto, RegisterDto } from './dto/login.dto';
import { Public } from './public.decorator';

type RequestUser = { ip?: string; user: AuthUser & { sub: string } };

function sessionCookie(token: string, maxAge: number) {
  const value = token ? encodeURIComponent(token) : '';
  const crossSite = process.env.NODE_ENV === 'production';
  const sameSite = crossSite ? 'None' : 'Lax';
  const secure = crossSite ? '; Secure' : '';
  return `afez_token=${value}; HttpOnly; Path=/; SameSite=${sameSite}${secure}; Max-Age=${maxAge}`;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: RequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.auth.guardLogin(request.ip || 'local');
    const result = await this.auth.login(dto.email, dto.password);
    response.setHeader('Set-Cookie', sessionCookie(result.token, 60 * 60 * 12));
    return { user: result.user };
  }

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(dto.name, dto.email, dto.password);
    response.setHeader('Set-Cookie', sessionCookie(result.token, 60 * 60 * 12));
    return { user: result.user };
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Set-Cookie', sessionCookie('', 0));
    return { ok: true };
  }

  @Get('me')
  me(@Req() request: RequestUser) {
    return this.auth.me(request.user);
  }
}
