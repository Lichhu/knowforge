import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { compare } from 'bcryptjs'
import { Request } from 'express'
import { Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service'
import { SystemMembership } from '../entities/system-membership.entity'
import { User } from '../entities/user.entity'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(SystemMembership) private readonly memberships: Repository<SystemMembership>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, request: Request) {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await this.users.findOne({ where: { email: normalizedEmail, active: true } })
    const valid = user ? await compare(password, user.passwordHash) : false

    if (!user || !valid) {
      await this.audit.record({
        actorId: user?.id ?? null,
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user?.id ?? null,
        details: { reason: 'invalid_credentials' },
        ip: request.ip,
        userAgent: request.get('user-agent'),
      })
      throw new UnauthorizedException('邮箱或密码错误')
    }

    const token = await this.jwt.signAsync({ sub: user.id, email: user.email })
    const profile = await this.profile(user.id)
    const memberships = await this.memberships.find({ where: { userId: user.id } })
    const loginEvents = memberships.length
      ? memberships.map(({ systemId }) => this.audit.record({
          systemId,
          actorId: user.id,
          action: 'auth.login',
          entityType: 'user',
          entityId: user.id,
          ip: request.ip,
          userAgent: request.get('user-agent'),
        }))
      : [this.audit.record({
          actorId: user.id,
          action: 'auth.login',
          entityType: 'user',
          entityId: user.id,
          ip: request.ip,
          userAgent: request.get('user-agent'),
        })]
    await Promise.all(loginEvents)

    return { token, profile }
  }

  async profile(userId: string) {
    const user = await this.users.findOneByOrFail({ id: userId })
    const memberships = await this.memberships.find({
      where: { userId },
      relations: { system: true },
      order: { createdAt: 'ASC' },
    })
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      systems: memberships.map(({ system, role }) => ({
        id: system.id,
        name: system.name,
        type: system.type,
        role,
      })),
    }
  }

  cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE') === 'true',
      sameSite: 'strict' as const,
      path: '/api',
      maxAge: this.parseTtl(this.config.get<string>('JWT_TTL') ?? '8h'),
    }
  }

  async recordLogout(userId: string, request: Request) {
    const memberships = await this.memberships.find({ where: { userId } })
    const logoutEvents = memberships.length
      ? memberships.map(({ systemId }) => this.audit.record({
          systemId,
          actorId: userId,
          action: 'auth.logout',
          entityType: 'user',
          entityId: userId,
          ip: request.ip,
          userAgent: request.get('user-agent'),
        }))
      : [this.audit.record({
          actorId: userId,
          action: 'auth.logout',
          entityType: 'user',
          entityId: userId,
          ip: request.ip,
          userAgent: request.get('user-agent'),
        })]
    await Promise.all(logoutEvents)
  }

  private parseTtl(value: string) {
    const match = /^(\d+)(m|h|d)$/.exec(value)
    if (!match) return 8 * 60 * 60 * 1000
    const amount = Number(match[1])
    const unit = match[2]
    return amount * (unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000)
  }
}
