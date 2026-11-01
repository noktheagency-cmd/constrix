import { Body, Controller, Get, Post, Param, Req } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { ProjectMaterialPlanService } from './project-material-plan.service';
@Controller('project-material-plans')
export class ProjectMaterialPlanController {
  constructor(private readonly plans: ProjectMaterialPlanService) {}
  @Get()
  projects(@Req() r: { user: AuthUser }) {
    return this.plans.projects(r.user);
  }
  @Get(':projectId/sources') sources(
    @Req() r: { user: AuthUser },
    @Param('projectId') p: string,
  ) {
    return this.plans.sources(r.user, p);
  }
  @Get(':projectId') report(
    @Req() r: { user: AuthUser },
    @Param('projectId') p: string,
  ) {
    return this.plans.report(r.user, p);
  }
  @Post(':projectId') create(
    @Req() r: { user: AuthUser },
    @Param('projectId') p: string,
    @Body() b: Record<string, unknown>,
  ) {
    return this.plans.create(r.user, p, b);
  }
  @Post(':projectId/:id/review') review(
    @Req() r: { user: AuthUser },
    @Param('projectId') p: string,
    @Param('id') id: string,
    @Body() b: Record<string, unknown>,
  ) {
    return this.plans.review(r.user, p, id, b);
  }
}
