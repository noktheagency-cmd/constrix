import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { rethrowPrisma } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { ChildSpec, ResourceSpec } from './resources';

type Row = Record<string, unknown>;

type ModelDelegate = {
  findMany(args: object): Promise<unknown[]>;
  findUnique(args: object): Promise<unknown>;
  create(args: object): Promise<unknown>;
  update(args: object): Promise<unknown>;
  delete(args: object): Promise<unknown>;
};

const HIDDEN = new Set(['createdAt', 'updatedAt']);

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serialize(value: unknown): unknown {
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map((item) => serialize(item));
  if (!isRow(value)) return value;

  const out: Row = {};
  for (const [key, item] of Object.entries(value)) {
    if (HIDDEN.has(key)) continue;
    out[key] = serialize(item);
  }
  return out;
}

function present(value: unknown, spec: ResourceSpec): unknown {
  const row = serialize(value);
  if (!isRow(row) || !spec.children) return row;

  for (const child of spec.children) {
    const items = row[child.field];
    if (!Array.isArray(items)) continue;
    const rows = items as unknown[];
    row[child.field] = rows.map((item) => {
      if (!isRow(item)) return item;
      const copy = { ...item };
      delete copy[child.foreignKey];
      delete copy.sort;
      return copy;
    });
  }
  return row;
}

function lineData(item: unknown, index: number, child: ChildSpec): Row {
  if (!isRow(item))
    throw new BadRequestException(`${child.field} must be objects`);
  const row: Row = { ...item, sort: index };
  delete row[child.foreignKey];
  if (row.id === '' || row.id === null) delete row.id;
  return row;
}

function parentData(
  body: Row,
  spec: ResourceSpec,
  mode: 'create' | 'update',
): Row {
  const childFields = new Set(
    (spec.children ?? []).map((child) => child.field),
  );
  const data: Row = {};
  for (const [key, value] of Object.entries(body)) {
    if (HIDDEN.has(key) || childFields.has(key)) continue;
    if (mode === 'update' && key === 'id') continue;
    if (value === undefined) continue;
    data[key] = value;
  }
  if (mode === 'create' && (data.id === '' || data.id === null)) delete data.id;

  for (const child of spec.children ?? []) {
    if (!(child.field in body)) continue;
    const items = body[child.field];
    if (!Array.isArray(items)) {
      throw new BadRequestException(`${child.field} must be a list`);
    }
    const nested: Row = {
      create: items.map((item, index) => lineData(item, index, child)),
    };
    if (mode === 'update') nested.deleteMany = {};
    data[child.field] = nested;
  }
  return data;
}

@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(spec: ResourceSpec) {
    return this.delegate(spec)
      .findMany({
        include: this.include(spec),
        orderBy: { id: 'asc' },
        take: 500,
      })
      .then((rows) => rows.map((row) => present(row, spec)))
      .catch((error: unknown) => rethrowPrisma(error));
  }

  async findOne(spec: ResourceSpec, id: string) {
    const row = await this.delegate(spec).findUnique({
      where: { id },
      include: this.include(spec),
    });
    if (!row) throw new NotFoundException(`Record ${id} was not found`);
    return present(row, spec);
  }

  async create(spec: ResourceSpec, body: unknown) {
    try {
      const row = await this.delegate(spec).create({
        data: parentData(this.bodyOf(body), spec, 'create'),
        include: this.include(spec),
      });
      return present(row, spec);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async update(spec: ResourceSpec, id: string, body: unknown) {
    await this.findOne(spec, id);
    try {
      const row = await this.delegate(spec).update({
        where: { id },
        data: parentData(this.bodyOf(body), spec, 'update'),
        include: this.include(spec),
      });
      return present(row, spec);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async remove(spec: ResourceSpec, id: string) {
    await this.findOne(spec, id);
    await this.delegate(spec).delete({ where: { id } });
  }

  private bodyOf(body: unknown): Row {
    if (!isRow(body)) throw new BadRequestException('Body must be an object');
    return body;
  }

  private include(spec: ResourceSpec) {
    if (!spec.children?.length) return undefined;
    return Object.fromEntries(
      spec.children.map((child) => [child.field, { orderBy: { sort: 'asc' } }]),
    );
  }

  private delegate(spec: ResourceSpec): ModelDelegate {
    const models = this.prisma as unknown as Record<string, ModelDelegate>;
    const model = models[spec.delegate];
    if (!model) throw new NotFoundException(`Unknown resource ${spec.route}`);
    return model;
  }
}
