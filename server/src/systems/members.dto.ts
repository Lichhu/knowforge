import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { SystemRole } from '../entities/system-membership.entity'

export class AddMemberDto {
  @IsEmail()
  @MaxLength(254)
  email!: string

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  initialPassword!: string

  @IsEnum(SystemRole)
  role!: SystemRole
}
