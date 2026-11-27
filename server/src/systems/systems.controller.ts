import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { hash } from 'bcryptjs'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AuthenticatedRequest } from '../auth/auth.types'
import { AuditLog } from '../entities/audit-log.entity'
import { System } from '../entities/system.entity'
import { SystemMembership, SystemRole } from '../entities/system-membership.entity'
import { User } from '../entities/user.entity'
import { AddMemberDto } from './members.dto'
import { SystemAccessService } from './system-access.service'
import { UpdateSystemProfileDto } from './system-profile.dto'

@UseGuards(JwtAuthGuard)
@Controller('systems')
export class SystemsController {
  constructor(
    private readonly access: SystemAccessService,
    private readonly audit: AuditService,
    @InjectRepository(System) private readonly systems: Repository<System>,
    @InjectRepository(SystemMembership) private readonly memberships: Repository<SystemMembership>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>,
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const memberships = await this.access.listMemberships(request.user.id)
    return memberships.map(({ system, role }) => ({ ...system, role }))
  }

  @Get(':systemId/members')
  async members(@Param('systemId', ParseUUIDPipe) systemId: string, @Req() request: AuthenticatedRequest) {
    await this.access.requireRole(request.user.id, systemId, [SystemRole.ADMIN, SystemRole.OWNER, SystemRole.AUDITOR])
    const memberships = await this.memberships.find({
      where: { systemId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    })
    return memberships.map(({ id, user, role, createdAt }) => ({
      id,
      user: { id: user.id, name: user.name, email: user.email, active: user.active },
      role,
      createdAt,
    }))
  }

  @Get(':systemId/profile')
  async getProfile(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId)
    const system = await this.systems.findOne({
      where: { id: systemId },
      relations: { profileConfirmer: true },
    })
    if (!system) return null
    return this.profileResponse(system)
  }

  @Put(':systemId/profile')
  async updateProfile(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Body() body: UpdateSystemProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, [SystemRole.ADMIN, SystemRole.OWNER])
    const system = await this.systems.findOneBy({ id: systemId })
    if (!system) return null
    system.name = body.name.trim()
    system.type = body.type
    system.description = body.description.trim()
    system.profile = {
      businessLine: body.businessLine.trim(),
      ownerName: body.ownerName.trim(),
      version: body.version.trim(),
      aliases: this.cleanList(body.aliases),
      modules: this.cleanList(body.modules),
      roles: this.cleanList(body.roles),
      workflows: this.cleanList(body.workflows),
      dependencies: this.cleanList(body.dependencies),
      testEnvironments: this.cleanList(body.testEnvironments),
      securityNotes: body.securityNotes.trim(),
      sourceReferences: this.cleanList(body.sourceReferences),
    }
    system.profileStatus = 'draft'
    system.profileConfirmedBy = null
    system.profileConfirmedAt = null
    const saved = await this.systems.save(system)
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'system.profile_updated',
      entityType: 'system',
      entityId: systemId,
      details: { status: 'draft' },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    const withConfirmer = await this.systems.findOne({
      where: { id: saved.id },
      relations: { profileConfirmer: true },
    })
    return this.profileResponse(withConfirmer ?? saved)
  }

  @Post(':systemId/profile/confirm')
  async confirmProfile(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, [SystemRole.ADMIN, SystemRole.OWNER])
    const system = await this.systems.findOneBy({ id: systemId })
    if (!system) return null
    if (!system.description.trim() || !system.profile.workflows?.length || !system.profile.modules?.length) {
      throw new BadRequestException('确认前请至少填写系统简介、一个功能模块和一条核心流程。')
    }
    system.profileStatus = 'confirmed'
    system.profileConfirmedBy = request.user.id
    system.profileConfirmedAt = new Date()
    await this.systems.save(system)
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'system.profile_confirmed',
      entityType: 'system',
      entityId: systemId,
      details: { modules: system.profile.modules.length, workflows: system.profile.workflows.length },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    const confirmed = await this.systems.findOne({
      where: { id: systemId },
      relations: { profileConfirmer: true },
    })
    return this.profileResponse(confirmed ?? system)
  }

  @Post(':systemId/members')
  async addMember(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Body() body: AddMemberDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.assertRoleScope(request.user.id, systemId, body.role)
    const email = body.email.trim().toLowerCase()
    let user = await this.users.findOneBy({ email })
    if (!user) {
      user = await this.users.save(
        this.users.create({
          email,
          name: body.name.trim(),
          passwordHash: await hash(body.initialPassword, 12),
        }),
      )
    }
    const existing = await this.memberships.findOneBy({ systemId, userId: user.id })
    if (existing) {
      existing.role = body.role
      await this.memberships.save(existing)
    } else {
      await this.memberships.save(this.memberships.create({ systemId, userId: user.id, role: body.role }))
    }
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: existing ? 'membership.role_updated' : 'membership.created',
      entityType: 'system_membership',
      entityId: user.id,
      details: { email, role: body.role },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return { user: { id: user.id, email: user.email, name: user.name }, role: body.role }
  }

  @Get(':systemId/audit')
  async auditTrail(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Req() request: AuthenticatedRequest,
    @Query('limit') limit = '100',
  ) {
    await this.access.requireRole(request.user.id, systemId, [SystemRole.ADMIN, SystemRole.OWNER, SystemRole.AUDITOR])
    const take = Number.isFinite(Number(limit)) ? Number(limit) : 100
    const rows = await this.logs.find({
      where: { systemId },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(take, 1), 200),
    })
    return rows.map(({ actor, ...event }) => ({
      ...event,
      actor: actor ? { id: actor.id, name: actor.name, email: actor.email } : null,
    }))
  }

  private cleanList(values: string[]) {
    return values.map((item) => item.trim()).filter(Boolean)
  }

  private profileResponse(system: System) {
    const {
      id,
      name,
      type,
      description,
      status,
      profile,
      profileStatus,
      profileConfirmedAt,
      profileConfirmer,
      createdAt,
      updatedAt,
    } = system
    return {
      id,
      name,
      type,
      description,
      status,
      profile: profile ?? {},
      profileStatus,
      profileConfirmedAt,
      profileConfirmedBy: profileConfirmer ? {
        id: profileConfirmer.id,
        name: profileConfirmer.name,
      } : null,
      createdAt,
      updatedAt,
    }
  }
}
