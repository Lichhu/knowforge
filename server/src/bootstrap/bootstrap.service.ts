import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { hash } from 'bcryptjs'
import { Repository } from 'typeorm'
import { System } from '../entities/system.entity'
import { SystemMembership, SystemRole } from '../entities/system-membership.entity'
import { User } from '../entities/user.entity'

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name)

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(System) private readonly systems: Repository<System>,
    @InjectRepository(SystemMembership) private readonly memberships: Repository<SystemMembership>,
  ) {}

  async onModuleInit() {
    const email = this.config.get<string>('BOOTSTRAP_ADMIN_EMAIL')?.trim().toLowerCase()
    const password = this.config.get<string>('BOOTSTRAP_ADMIN_PASSWORD')
    const name = this.config.get<string>('BOOTSTRAP_ADMIN_NAME')?.trim() || '平台管理员'
    if (!email || !password) {
      this.logger.warn('Bootstrap admin not configured; set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create the first account.')
      return
    }
    if (password.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters')

    let user = await this.users.findOneBy({ email })
    if (!user) {
      user = await this.users.save(
        this.users.create({ email, name, passwordHash: await hash(password, 12) }),
      )
      this.logger.log(`Created initial administrator ${email}`)
    }

    let system = await this.systems.findOne({ where: { name: '测试管理平台' }, order: { createdAt: 'ASC' } })
    if (!system) {
      system = await this.systems.save(
        this.systems.create({
          name: '测试管理平台',
          type: 'web',
          description: '首期试点：测试用例管理流程',
          status: 'initializing',
        }),
      )
    }

    const membership = await this.memberships.findOneBy({ systemId: system.id, userId: user.id })
    if (!membership) {
      await this.memberships.save(
        this.memberships.create({ systemId: system.id, userId: user.id, role: SystemRole.ADMIN }),
      )
    }
  }
}
