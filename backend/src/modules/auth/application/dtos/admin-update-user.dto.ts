import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsIn,
  ArrayMinSize,
  MaxLength,
  MinLength,
} from 'class-validator';
export class AdminUpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) lastName?: string;
  @IsOptional()
  @IsEmail()
  email?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(['ADMIN', 'RRHH', 'DOCENTE', 'ESTUDIANTE'], { each: true })
  roles?: string[];
}
