import { AutoApplyDto } from './dto/auto-apply.dto';
import { OpenclawService } from './openclaw.service';
export declare class OpenclawController {
    private readonly openclawService;
    constructor(openclawService: OpenclawService);
    autoApply(dto: AutoApplyDto): Promise<{
        runId: string;
        status: string;
        sessionId: string | undefined;
        sessionKey: string | undefined;
        finalText: string | undefined;
        raw: import("./types/openclaw-agent.types").OpenClawAgentResult;
    }>;
}
