import { Controller, Get } from '@nestjs/common';
import { resources } from './resources';

@Controller()
export class CatalogController {
  @Get()
  index() {
    return {
      resources: [
        '/api/health',
        '/api/clients',
        '/api/projects',
        ...resources.map((resource) => `/api/${resource.route}`),
      ],
    };
  }
}
