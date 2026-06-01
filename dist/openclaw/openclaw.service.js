"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var OpenclawService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenclawService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
let OpenclawService = OpenclawService_1 = class OpenclawService {
    logger = new common_1.Logger(OpenclawService_1.name);
    binary = process.env.OPENCLAW_BINARY ?? 'openclaw';
    agentId = process.env.OPENCLAW_AGENT_ID ?? 'main';
    sessionKey = process.env.OPENCLAW_SESSION_KEY ?? 'agent:main:auto-apply';
    timeoutMs = Number(process.env.OPENCLAW_TIMEOUT_MS ?? 600000);
    async autoApply(dto) {
        const message = this.buildAutoApplyMessage(dto);
        return this.runAgentCommand(message);
    }
    buildAutoApplyMessage(dto) {
        if (dto.jobUrl) {
            return `/apply ${dto.jobUrl.trim()}`;
        }
        const jobId = dto.normalizedJobId;
        if (!jobId) {
            throw new common_1.InternalServerErrorException('jobId hoặc jobUrl phải được cung cấp.');
        }
        return `/apply ${jobId}`;
    }
    async runAgentCommand(message, options) {
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
    execWithTimeout(args, timeoutMs) {
        return new Promise((resolve, reject) => {
            this.logger.log(`Running: ${this.binary} ${args.join(' ')}`);
            const child = (0, child_process_1.spawn)(this.binary, args, {
                env: process.env,
                cwd: process.cwd(),
            });
            let stdout = '';
            let stderr = '';
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished)
                    return;
                finished = true;
                child.kill('SIGTERM');
                reject(new common_1.InternalServerErrorException('OpenClaw command timed out.'));
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
                if (finished)
                    return;
                finished = true;
                clearTimeout(timeout);
                reject(new common_1.InternalServerErrorException(`OpenClaw failed: ${error.message}`));
            });
            child.on('close', (code) => {
                if (finished)
                    return;
                finished = true;
                clearTimeout(timeout);
                if (code !== 0) {
                    reject(new common_1.InternalServerErrorException(stderr || stdout || 'OpenClaw exited with error.'));
                    return;
                }
                resolve(stdout.trim());
            });
        });
    }
    parseAgentResponse(stdout, options) {
        const jsonString = this.extractJson(stdout);
        let parsed;
        try {
            parsed = JSON.parse(jsonString);
        }
        catch (error) {
            this.logger.error('Failed to parse OpenClaw JSON', error);
            throw new common_1.InternalServerErrorException('Không thể parse kết quả OpenClaw.');
        }
        const sessionId = parsed.result?.meta?.agentMeta?.sessionId;
        const sessionKey = parsed.result?.meta?.systemPromptReport?.sessionKey ?? options?.sessionKey ?? this.sessionKey;
        const finalText = parsed.result?.payloads?.map((payload) => payload.text).filter(Boolean).join('\n\n') ?? '';
        return {
            raw: parsed,
            sessionId,
            sessionKey,
            finalText,
        };
    }
    extractJson(output) {
        const start = output.indexOf('{');
        const end = output.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) {
            throw new common_1.InternalServerErrorException('OpenClaw không trả về JSON hợp lệ.');
        }
        return output.slice(start, end + 1);
    }
};
exports.OpenclawService = OpenclawService;
exports.OpenclawService = OpenclawService = OpenclawService_1 = __decorate([
    (0, common_1.Injectable)()
], OpenclawService);
//# sourceMappingURL=openclaw.service.js.map