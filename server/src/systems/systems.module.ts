import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { AuditLog } from '../entities/audit-log.entity'
import { System } from '../entities/system.entity'
import { SystemMembership } from '../entities/system-membership.entity'
import { User } from '../entities/user.entity'
import { SystemsController } from './systems.controller'
import { SystemAccessService } from './system-access.service'

@Module({
  imports: [TypeOrmModule.forFeature([System, SystemMembership, User, AuditLog]), AuditModule],
  controllers: [SystemsController],
  providers: [SystemAccessService],
  exports: [SystemAccessService],
})
export class SystemsModule {}
