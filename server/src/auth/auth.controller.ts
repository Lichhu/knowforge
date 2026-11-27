import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common'
import { Request, Response } from 'express'
import { AuthenticatedRequest } from './auth.types'
import { AuthService } from './auth.service'
import { LoginDto } from './login.dto'
import { Body } from '@nestjs/common'
import { JwtAuthGuard } from './jwt-auth.guard'
import { Throttle } from '@nestjs/throttler'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() body: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const { token, profile } = await this.auth.login(body.email, body.password, request)
    response.cookie('access_token', token, this.auth.cookieOptions())
    return { user: profile }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.profile(request.user.id).then((user) => ({ user }))
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    await this.auth.recordLogout(request.user.id, request)
    response.clearCookie('access_token', { ...this.auth.cookieOptions(), maxAge: undefined })
    return { ok: true }
  }
}
