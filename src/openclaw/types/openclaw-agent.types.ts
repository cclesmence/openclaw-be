export interface OpenClawAgentPayload {
  text?: string;
  mediaUrl?: string | null;
}

export interface OpenClawAgentMeta {
  durationMs?: number;
  agentMeta?: {
    sessionId?: string;
  };
  systemPromptReport?: {
    sessionKey?: string;
  };
}

export interface OpenClawAgentResult {
  runId: string;
  status: string;
  summary?: string;
  result?: {
    payloads?: OpenClawAgentPayload[];
    meta?: OpenClawAgentMeta;
  };
}

export interface RunAgentCommandOptions {
  agentId?: string;
  sessionKey?: string;
  deliver?: boolean;
  timeoutMs?: number;
}

export interface RunAgentCommandResponse {
  raw: OpenClawAgentResult;
  sessionId?: string;
  sessionKey?: string;
  finalText?: string;
}
