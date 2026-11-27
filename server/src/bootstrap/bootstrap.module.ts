import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { System } from '../entities/system.entity'
import { SystemMembership } from '../entities/system-membership.entity'
import { User } from '../entities/user.entity'
import { BootstrapService } from './bootstrap.service'

@Module({
  imports: [TypeOrmModule.forFeature([User, System, SystemMembership])],
  providers: [BootstrapService],
})
export class BootstrapModule {}
