import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function rethrowPrisma(error: unknown): never {
  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new BadRequestException('The record does not match this resource');
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException('A record with this id or name already exists');
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new NotFoundException('Record was not found');
  }
  throw error;
}
