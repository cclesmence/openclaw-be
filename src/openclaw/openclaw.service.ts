import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { AutoApplyDto } from './dto/auto-apply.dto';
import {
  OpenClawAgentResult,
  RunAgentCommandOptions,
  RunAgentCommandResponse,
} from './types/openclaw-agent.types';

@Injectable()
export class OpenclawService {
  private readonly logger = new Logger(OpenclawService.name);
  private readonly binary = process.env.OPENCLAW_BINARY ?? 'openclaw';
  private readonly agentId = process.env.OPENCLAW_AGENT_ID ?? 'main';
  private readonly sessionKey = process.env.OPENCLAW_SESSION_KEY ?? 'agent:main:auto-apply';
  private readonly timeoutMs = Number(process.env.OPENCLAW_TIMEOUT_MS ?? 600000);

  async autoApply(dto: AutoApplyDto): Promise<RunAgentCommandResponse> {
    const message = this.buildAutoApplyMessage(dto);
    return this.runAgentCommand(message);
  }

  private buildAutoApplyMessage(dto: AutoApplyDto): string {
    if (dto.jobUrl) {
      return `/apply ${dto.jobUrl.trim()}`;
    }

    const jobId = dto.normalizedJobId;
    if (!jobId) {
      throw new InternalServerErrorException('jobId hoặc jobUrl phải được cung cấp.');
    }

    return `/apply ${jobId}`;
  }

  private async runAgentCommand(message: string, options?: RunAgentCommandOptions) {
    const args = [
      'agent',
      '--agent',
      options?.agentId ?? this.agentId,
      '--session-key',
      options?.sessionKey ?? this.sessionKey,
      '--message',
      message,
      '--json',
    ];

    if (options?.deliver) {
      args.push('--deliver');
    }

    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;

    const stdout = await this.execWithTimeout(args, timeoutMs);
    return this.parseAgentResponse(stdout, options);
  }

  private execWithTimeout(args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.logger.log(`Running: ${this.binary} ${args.join(' ')}`);
      const child = spawn(this.binary, args, {
        env: process.env,
        cwd: process.cwd(),
      });

      let stdout = '';
      let stderr = '';
      let finished = false;

      const timeout = setTimeout(() => {
        if (finished) return;
        finished = true;
        child.kill('SIGTERM');
        reject(new InternalServerErrorException('OpenClaw command timed out.'));
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        this.logger.warn(text.trim());
      });

      child.on('error', (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        reject(new InternalServerErrorException(`OpenClaw failed: ${error.message}`));
      });

      child.on('close', (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new InternalServerErrorException(stderr || stdout || 'OpenClaw exited with error.'));
          return;
        }

        resolve(stdout.trim());
      });
    });
  }

  private parseAgentResponse(
    stdout: string,
    options?: RunAgentCommandOptions,
  ): RunAgentCommandResponse {
    const jsonString = this.extractJson(stdout);

    let parsed: OpenClawAgentResult;
    try {
      parsed = JSON.parse(jsonString);
    } catch (error) {
      this.logger.error('Failed to parse OpenClaw JSON', error as Error);
      throw new InternalServerErrorException('Không thể parse kết quả OpenClaw.');
    }

    const sessionId = parsed.result?.meta?.agentMeta?.sessionId;
    const sessionKey =
      parsed.result?.meta?.systemPromptReport?.sessionKey ?? options?.sessionKey ?? this.sessionKey;
    const finalText =
      parsed.result?.payloads?.map((payload) => payload.text).filter(Boolean).join('\n\n') ?? '';

    return {
      raw: parsed,
      sessionId,
      sessionKey,
      finalText,
    };
  }

  private extractJson(output: string): string {
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      throw new InternalServerErrorException('OpenClaw không trả về JSON hợp lệ.');
    }

    return output.slice(start, end + 1);
  }
}
