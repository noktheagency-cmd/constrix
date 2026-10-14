import { ProjectStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PhaseDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsBoolean()
  current?: boolean;
}

export class ProjectNoteDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  date: string;

  @IsString()
  text: string;
}

export class CreateProjectDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsString()
  client: string;

  @IsString()
  district: string;

  @IsString()
  city: string;

  @IsString()
  address: string;

  @IsString()
  phase: string;

  @IsInt()
  @Min(0)
  @Max(100)
  progress: number;

  @IsNumber()
  @Min(0)
  budget: number;

  @IsNumber()
  @Min(0)
  spent: number;

  @IsDateString()
  start: string;

  @IsDateString()
  end: string;

  @IsString()
  manager: string;

  @IsInt()
  @Min(0)
  crew: number;

  @IsEnum(ProjectStatus)
  status: ProjectStatus;

  @IsString()
  type: string;

  @IsInt()
  @Min(0)
  floors: number;

  @IsNumber()
  @Min(0)
  area: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhaseDto)
  phases?: PhaseDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectNoteDto)
  notes?: ProjectNoteDto[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  smetaId?: string;
}
