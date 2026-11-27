import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { AuthPrincipal } from './auth.types'

const cookieExtractor = (request: { cookies?: Record<string, string> } | undefined) =>
  request?.cookies?.access_token ?? null

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    })
  }

  async validate(payload: { sub: string }): Promise<AuthPrincipal> {
    const user = await this.users.findOne({ where: { id: payload.sub, active: true } })
    if (!user) throw new UnauthorizedException('用户不存在或已停用')
    return { id: user.id, email: user.email, name: user.name }
  }
}
