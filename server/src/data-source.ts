import 'dotenv/config'
import { DataSource } from 'typeorm'
import { InitialSchema1730000000000 } from './migrations/1730000000000-InitialSchema'
import { AddScenarioGenerationMetadata1730000001000 } from './migrations/1730000001000-AddScenarioGenerationMetadata'
import { SystemProfile1730000002000 } from './migrations/1730000002000-SystemProfile'

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/entities/*.entity{.ts,.js}'],
  migrations: [
    InitialSchema1730000000000,
    AddScenarioGenerationMetadata1730000001000,
    SystemProfile1730000002000,
  ],
  synchronize: false,
})
