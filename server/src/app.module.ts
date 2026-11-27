import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from './auth/auth.module'
import { AuditLog } from './entities/audit-log.entity'
import { Clarification } from './entities/clarification.entity'
import { KnowledgeEntry } from './entities/knowledge-entry.entity'
import { Requirement } from './entities/requirement.entity'
import { System } from './entities/system.entity'
import { SystemMembership } from './entities/system-membership.entity'
import { TestScenario } from './entities/test-scenario.entity'
import { User } from './entities/user.entity'
import { AiModule } from './ai/ai.module'
import { AuditModule } from './audit/audit.module'
import { BootstrapModule } from './bootstrap/bootstrap.module'
import { RequirementsModule } from './requirements/requirements.module'
import { SystemsModule } from './systems/systems.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => {
        const secret = env.JWT_SECRET
        if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required')
        if (!secret || secret.length < 32 || secret.startsWith('replace-with-')) {
          throw new Error('Set JWT_SECRET to a unique random value of at least 32 characters')
        }
        if (env.NODE_ENV === 'production' && env.COOKIE_SECURE !== 'true') {
          throw new Error('COOKIE_SECURE=true is required in production')
        }
        return env
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
        migrations: [__dirname + '/migrations/*{.js,.ts}'],
        retryAttempts: 8,
        retryDelay: 3000,
      }),
    }),
    TypeOrmModule.forFeature([
      User,
      System,
      SystemMembership,
      Requirement,
      Clarification,
      TestScenario,
      KnowledgeEntry,
      AuditLog,
    ]),
    AuthModule,
    AuditModule,
    AiModule,
    SystemsModule,
    RequirementsModule,
    BootstrapModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
