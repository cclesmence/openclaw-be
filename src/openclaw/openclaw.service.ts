import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { Socket } from 'net';
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
  private readonly sessionKey =
    process.env.OPENCLAW_SESSION_KEY ?? 'agent:main:auto-apply';
  private readonly timeoutMs = Number(
    process.env.OPENCLAW_TIMEOUT_MS ?? 600000,
  );

  async autoApply(dto: AutoApplyDto): Promise<RunAgentCommandResponse> {
    await this.ensureChrome();
    const message = this.buildAutoApplyMessage(dto);
    return this.runAgentCommand(message);
  }

  private buildAutoApplyMessage(dto: AutoApplyDto): string {
    const coverLetter = dto.coverLetter?.trim();
    if (!coverLetter) {
      throw new InternalServerErrorException('coverLetter phải được cung cấp.');
    }

    const jobIdentifier = dto.jobUrl?.trim() ?? dto.normalizedJobId;
    if (!jobIdentifier) {
      throw new InternalServerErrorException(
        'jobId hoặc jobUrl phải được cung cấp.',
      );
    }

    const jobType = dto.normalizedJobType;
    if (!jobType) {
      throw new InternalServerErrorException(
        'jobType phải là Hourly hoặc Fixed.',
      );
    }

    return `/apply ${jobIdentifier} jobType=${jobType}\n\nCOVER_LETTER:\n${coverLetter}`;
  }

  private async runAgentCommand(
    message: string,
    options?: RunAgentCommandOptions,
  ) {
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

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += typeof chunk === 'string' ? chunk : chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString();
        stderr += text;
        this.logger.warn(text.trim());
      });

      child.on('error', (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        reject(
          new InternalServerErrorException(`OpenClaw failed: ${error.message}`),
        );
      });

      child.on('close', (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);

        if (code !== 0) {
          reject(
            new InternalServerErrorException(
              stderr || stdout || 'OpenClaw exited with error.',
            ),
          );
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch (error) {
      this.logger.error('Failed to parse OpenClaw JSON', error as Error);
      throw new InternalServerErrorException(
        'Không thể parse kết quả OpenClaw.',
      );
    }

    if (!this.isOpenClawAgentResult(parsed)) {
      this.logger.error('OpenClaw JSON có cấu trúc không hợp lệ.');
      throw new InternalServerErrorException(
        'OpenClaw trả về dữ liệu không hợp lệ.',
      );
    }

    const sessionId = parsed.result?.meta?.agentMeta?.sessionId;
    const sessionKey =
      parsed.result?.meta?.systemPromptReport?.sessionKey ??
      options?.sessionKey ??
      this.sessionKey;
    const finalText =
      parsed.result?.payloads
        ?.map((payload) => payload.text)
        .filter(Boolean)
        .join('\n\n') ?? '';

    return {
      raw: parsed,
      sessionId,
      sessionKey,
      finalText,
    };
  }

  private isOpenClawAgentResult(
    payload: unknown,
  ): payload is OpenClawAgentResult {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const candidate = payload as Partial<OpenClawAgentResult>;
    return (
      typeof candidate.runId === 'string' &&
      typeof candidate.status === 'string'
    );
  }

  private async ensureChrome(): Promise<void> {
    const port = 9222;
    if (await this.isPortListening(port)) {
      return;
    }

    const chromePath =
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const chromeArgs = [
      '--remote-debugging-port=9222',
      '--user-data-dir=/tmp/openclaw-chrome',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-mode',
    ];

    this.logger.log('Launching Chrome for remote debugging on port 9222...');
    try {
      const chrome = spawn(chromePath, chromeArgs, {
        detached: true,
        stdio: 'ignore',
      });
      chrome.unref();
    } catch (error) {
      this.logger.error('Failed to launch Chrome', error as Error);
      throw new InternalServerErrorException(
        'Không thể khởi động Chrome để auto-apply.',
      );
    }

    await this.waitForPort(port, 5000);
  }

  private isPortListening(port: number, host = '127.0.0.1'): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new Socket();
      const cleanup = () => socket.removeAllListeners();

      socket.once('connect', () => {
        cleanup();
        socket.destroy();
        resolve(true);
      });

      socket.once('error', () => {
        cleanup();
        socket.destroy();
        resolve(false);
      });

      socket.setTimeout(500, () => {
        cleanup();
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });
  }

  private async waitForPort(port: number, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.isPortListening(port)) {
        return;
      }
      await this.delay(200);
    }
    throw new InternalServerErrorException(
      'Chrome remote debugging không sẵn sàng.',
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractJson(output: string): string {
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      throw new InternalServerErrorException(
        'OpenClaw không trả về JSON hợp lệ.',
      );
    }

    return output.slice(start, end + 1);
  }
}
