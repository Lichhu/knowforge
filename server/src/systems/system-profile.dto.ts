import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export class UpdateSystemProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string

  @IsString()
  @IsIn(['web', 'api', 'batch', 'data', 'messaging', 'hybrid'])
  type!: string

  @IsString()
  @MaxLength(5000)
  description!: string

  @IsString()
  @MaxLength(160)
  businessLine!: string

  @IsString()
  @MaxLength(160)
  ownerName!: string

  @IsString()
  @MaxLength(80)
  version!: string

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  aliases!: string[]

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  modules!: string[]

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  roles!: string[]

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  workflows!: string[]

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  dependencies!: string[]

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  testEnvironments!: string[]

  @IsString()
  @MaxLength(5000)
  securityNotes!: string

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  sourceReferences!: string[]
}
