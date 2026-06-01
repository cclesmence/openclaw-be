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
const net_1 = require("net");
let OpenclawService = OpenclawService_1 = class OpenclawService {
    logger = new common_1.Logger(OpenclawService_1.name);
    binary = process.env.OPENCLAW_BINARY ?? 'openclaw';
    agentId = process.env.OPENCLAW_AGENT_ID ?? 'main';
    sessionKey = process.env.OPENCLAW_SESSION_KEY ?? 'agent:main:auto-apply';
    timeoutMs = Number(process.env.OPENCLAW_TIMEOUT_MS ?? 600000);
    async autoApply(dto) {
        await this.ensureChrome();
        const message = this.buildAutoApplyMessage(dto);
        return this.runAgentCommand(message);
    }
    buildAutoApplyMessage(dto) {
        const coverLetter = dto.coverLetter?.trim();
        if (!coverLetter) {
            throw new common_1.InternalServerErrorException('coverLetter phải được cung cấp.');
        }
        const jobIdentifier = dto.jobUrl?.trim() ?? dto.normalizedJobId;
        if (!jobIdentifier) {
            throw new common_1.InternalServerErrorException('jobId hoặc jobUrl phải được cung cấp.');
        }
        const jobType = dto.normalizedJobType;
        if (!jobType) {
            throw new common_1.InternalServerErrorException('jobType phải là Hourly hoặc Fixed.');
        }
        return `/apply ${jobIdentifier} jobType=${jobType}\n\nCOVER_LETTER:\n${coverLetter}`;
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
                stdout += typeof chunk === 'string' ? chunk : chunk.toString();
            });
            child.stderr.on('data', (chunk) => {
                const text = typeof chunk === 'string' ? chunk : chunk.toString();
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
        if (!this.isOpenClawAgentResult(parsed)) {
            this.logger.error('OpenClaw JSON có cấu trúc không hợp lệ.');
            throw new common_1.InternalServerErrorException('OpenClaw trả về dữ liệu không hợp lệ.');
        }
        const sessionId = parsed.result?.meta?.agentMeta?.sessionId;
        const sessionKey = parsed.result?.meta?.systemPromptReport?.sessionKey ??
            options?.sessionKey ??
            this.sessionKey;
        const finalText = parsed.result?.payloads
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
    isOpenClawAgentResult(payload) {
        if (!payload || typeof payload !== 'object') {
            return false;
        }
        const candidate = payload;
        return (typeof candidate.runId === 'string' &&
            typeof candidate.status === 'string');
    }
    async ensureChrome() {
        const port = 9222;
        if (await this.isPortListening(port)) {
            return;
        }
        const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        const chromeArgs = [
            '--remote-debugging-port=9222',
            '--user-data-dir=/tmp/openclaw-chrome',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-mode',
        ];
        this.logger.log('Launching Chrome for remote debugging on port 9222...');
        try {
            const chrome = (0, child_process_1.spawn)(chromePath, chromeArgs, {
                detached: true,
                stdio: 'ignore',
            });
            chrome.unref();
        }
        catch (error) {
            this.logger.error('Failed to launch Chrome', error);
            throw new common_1.InternalServerErrorException('Không thể khởi động Chrome để auto-apply.');
        }
        await this.waitForPort(port, 5000);
    }
    isPortListening(port, host = '127.0.0.1') {
        return new Promise((resolve) => {
            const socket = new net_1.Socket();
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
    async waitForPort(port, timeoutMs) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (await this.isPortListening(port)) {
                return;
            }
            await this.delay(200);
        }
        throw new common_1.InternalServerErrorException('Chrome remote debugging không sẵn sàng.');
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
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