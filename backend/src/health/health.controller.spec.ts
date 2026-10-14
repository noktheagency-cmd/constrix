import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([1]),
          },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports the database as up', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });
});
