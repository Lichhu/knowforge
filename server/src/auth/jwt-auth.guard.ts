import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context)
  }

  handleRequest<TUser = unknown>(error: unknown, user: TUser | null): TUser {
    if (error || !user) throw new UnauthorizedException('登录状态无效或已过期')
    return user
  }
}
