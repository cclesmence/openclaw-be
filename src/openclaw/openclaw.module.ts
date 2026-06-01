import { Module } from '@nestjs/common';
import { OpenclawController } from './openclaw.controller';
import { OpenclawService } from './openclaw.service';

@Module({
  controllers: [OpenclawController],
  providers: [OpenclawService],
  exports: [OpenclawService],
})
export class OpenclawModule {}
