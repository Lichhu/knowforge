import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog } from '../entities/audit-log.entity'

export type AuditEvent = {
  systemId?: string | null
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  details?: Record<string, unknown>
  ip?: string
  userAgent?: string
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  async record(event: AuditEvent) {
    const ip = event.ip && event.ip !== '::1' ? event.ip : event.ip === '::1' ? '127.0.0.1' : null
    await this.logs.insert({
      systemId: event.systemId ?? null,
      actorId: event.actorId ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      details: (event.details ?? {}) as never,
      ip,
      userAgent: event.userAgent?.slice(0, 500) ?? null,
    })
  }

  list(systemId: string, take = 100) {
    return this.logs.find({
      where: { systemId },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(take, 1), 200),
    })
  }
}
