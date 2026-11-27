import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateRequirementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(240)
  sourceName?: string

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  sourceText?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  module?: string
}

export class AnswerClarificationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(10_000)
  answer!: string
}

export class CreateClarificationDto {
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  question!: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rationale?: string

  @IsOptional()
  @IsBoolean()
  blocksDesign?: boolean
}
