import { ArrayMaxSize, IsArray, IsString, MaxLength, MinLength } from 'class-validator'

export class SaveKnowledgeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  title!: string

  @IsString()
  @MinLength(3)
  @MaxLength(20_000)
  content!: string

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  module!: string

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  sourceReferences!: string[]
}
