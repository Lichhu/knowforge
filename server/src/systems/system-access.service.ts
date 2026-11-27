import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { SystemMembership, SystemRole } from '../entities/system-membership.entity'

@Injectable()
export class SystemAccessService {
  constructor(@InjectRepository(SystemMembership) private readonly memberships: Repository<SystemMembership>) {}

  async requireRole(userId: string, systemId: string, roles?: SystemRole[]) {
    const membership = await this.memberships.findOne({ where: { userId, systemId } })
    if (!membership) throw new NotFoundException('系统不存在或无权访问')
    if (roles && !roles.includes(membership.role)) throw new ForbiddenException('当前角色无权执行此操作')
    return membership
  }

  async listMemberships(userId: string) {
    return this.memberships.find({
      where: { userId },
      relations: { system: true },
      order: { createdAt: 'ASC' },
    })
  }

  async assertRoleScope(userId: string, systemId: string, role: SystemRole) {
    const membership = await this.requireRole(userId, systemId)
    if (role === SystemRole.ADMIN && membership.role !== SystemRole.ADMIN) {
      throw new ForbiddenException('只有管理员可以授予管理员角色')
    }
    if (membership.role === SystemRole.OWNER && role !== SystemRole.TESTER) {
      throw new ForbiddenException('系统负责人只能分配测试人员角色')
    }
    return membership
  }
}
