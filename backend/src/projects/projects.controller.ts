import { AuthUser } from '../auth/auth.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  findAll(@Req() req:{user:AuthUser}) {
    return this.projects.findAll(req.user);
  }

  @Get(':id/procedures')
  procedures(@Param('id') id: string,@Req() req:{user:AuthUser}) {
    return this.projects.procedures(id,req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string,@Req() req:{user:AuthUser}) {
    return this.projects.findOne(id,req.user);
  }

  @Post()
  create(@Body() dto: CreateProjectDto,@Req() req:{user:AuthUser}) {
    return this.projects.create(dto,req.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto,@Req() req:{user:AuthUser}) {
    return this.projects.update(id, dto,req.user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string,@Req() req:{user:AuthUser}) {
    return this.projects.remove(id,req.user);
  }
}
