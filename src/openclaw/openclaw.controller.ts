import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AutoApplyDto } from './dto/auto-apply.dto';
import { OpenclawService } from './openclaw.service';

@Controller()
export class OpenclawController {
  constructor(private readonly openclawService: OpenclawService) {}

  @Post('auto-apply')
  @HttpCode(HttpStatus.ACCEPTED)
  autoApply(@Body() dto: AutoApplyDto) {
    this.openclawService.queueAutoApply(dto);
    return { status: 'queued' };
  }
}
