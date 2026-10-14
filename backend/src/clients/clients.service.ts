import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { rethrowPrisma } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const clientInclude = {
  projects: { select: { budget: true } },
} satisfies Prisma.ClientInclude;

type ClientRecord = Prisma.ClientGetPayload<{ include: typeof clientInclude }>;

export type ClientResponse = {
  id: string;
  name: string;
  sector: string;
  contact: string;
  phone: string;
  email: string;
  city: string;
  projects: number;
  value: number;
  since: string;
};

function toClient(client: ClientRecord): ClientResponse {
  const value = client.projects.reduce(
    (sum, project) => sum + project.budget.toNumber(),
    0,
  );
  return {
    id: client.id,
    name: client.name,
    sector: client.sector,
    contact: client.contact,
    phone: client.phone,
    email: client.email,
    city: client.city,
    projects: client.projects.length,
    value,
    since: client.since,
  };
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ClientResponse[]> {
    const clients = await this.prisma.client.findMany({
      include: clientInclude,
      orderBy: { name: 'asc' },
      take: 500,
    });
    return clients.map(toClient);
  }

  async findOne(id: string): Promise<ClientResponse> {
    return toClient(await this.findRecord(id));
  }

  async create(dto: CreateClientDto): Promise<ClientResponse> {
    try {
      const client = await this.prisma.client.create({
        data: {
          ...(dto.id ? { id: dto.id } : {}),
          name: dto.name,
          sector: dto.sector,
          contact: dto.contact,
          phone: dto.phone,
          email: dto.email,
          city: dto.city,
          since: dto.since,
        },
        include: clientInclude,
      });
      return toClient(client);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientResponse> {
    const existing = await this.findRecord(id);
    try {
      const client = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.client.update({
          where: { id },
          data: {
            name: dto.name,
            sector: dto.sector,
            contact: dto.contact,
            phone: dto.phone,
            email: dto.email,
            city: dto.city,
            since: dto.since,
          },
          include: clientInclude,
        });
        if (dto.name && dto.name !== existing.name) {
          await tx.project.updateMany({
            where: { clientId: id },
            data: { clientName: dto.name },
          });
        }
        return updated;
      });
      return toClient(client);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async remove(id: string): Promise<void> {
    await this.findRecord(id);
    await this.prisma.client.delete({ where: { id } });
  }

  private async findRecord(id: string): Promise<ClientRecord> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: clientInclude,
    });
    if (!client) throw new NotFoundException(`Client ${id} was not found`);
    return client;
  }
}
