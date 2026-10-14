import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateClientDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsString()
  sector: string;

  @IsString()
  contact: string;

  @IsString()
  phone: string;

  @IsEmail()
  email: string;

  @IsString()
  city: string;

  @IsString()
  since: string;
}
