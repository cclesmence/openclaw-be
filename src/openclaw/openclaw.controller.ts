import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AutoApplyDto } from './dto/auto-apply.dto';
import { OpenclawService } from './openclaw.service';

@Controller()
export class OpenclawController {
  constructor(private readonly openclawService: OpenclawService) {}

  @Post('auto-apply')
  @HttpCode(HttpStatus.ACCEPTED)
  async autoApply(@Body() dto: AutoApplyDto) {
    const result = await this.openclawService.autoApply(dto);

    return {
      runId: result.raw.runId,
      status: result.raw.status,
      sessionId: result.sessionId,
      sessionKey: result.sessionKey,
      finalText: result.finalText,
      raw: result.raw,
    };
  }
}
