import {Global,Module} from '@nestjs/common';
import {BlobFilesService} from './blob-files.service';
import {BlobFilesController} from './blob-files.controller';
@Global() @Module({providers:[BlobFilesService],controllers:[BlobFilesController],exports:[BlobFilesService]})
export class BlobFilesModule{}
