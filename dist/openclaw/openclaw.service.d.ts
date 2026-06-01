import { AutoApplyDto } from './dto/auto-apply.dto';
import { RunAgentCommandResponse } from './types/openclaw-agent.types';
export declare class OpenclawService {
    private readonly logger;
    private readonly binary;
    private readonly agentId;
    private readonly sessionKey;
    private readonly timeoutMs;
    private readonly toolJobsWebhookUrl;
    private readonly toolJobsWebhookToken;
    autoApply(dto: AutoApplyDto): Promise<RunAgentCommandResponse>;
    queueAutoApply(dto: AutoApplyDto): void;
    private buildAutoApplyMessage;
    private executeAutoApplyCommand;
    private runAgentCommand;
    private execWithTimeout;
    private parseAgentResponse;
    private isOpenClawAgentResult;
    private ensureChrome;
    private isPortListening;
    private waitForPort;
    private delay;
    private extractJson;
    private handleAutoApplySuccess;
    private handleAutoApplyError;
    private notifyToolJobs;
}
