import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AiModule } from '../ai/ai.module'
import { AuditModule } from '../audit/audit.module'
import { Clarification } from '../entities/clarification.entity'
import { KnowledgeEntry } from '../entities/knowledge-entry.entity'
import { Requirement } from '../entities/requirement.entity'
import { System } from '../entities/system.entity'
import { TestScenario } from '../entities/test-scenario.entity'
import { SystemsModule } from '../systems/systems.module'
import { RequirementsController } from './requirements.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([Requirement, Clarification, TestScenario, KnowledgeEntry, System]),
    SystemsModule,
    AuditModule,
    AiModule,
  ],
  controllers: [RequirementsController],
})
export class RequirementsModule {}
