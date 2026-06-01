import { IsNotEmpty, IsString, IsUrl, ValidateIf } from 'class-validator';

export class AutoApplyDto {
  @ValidateIf((dto: AutoApplyDto) => !dto.jobUrl)
  @IsString()
  @IsNotEmpty()
  jobId?: string;

  @ValidateIf((dto: AutoApplyDto) => !dto.jobId)
  @IsUrl({ require_tld: true, require_protocol: true })
  jobUrl?: string;

  @IsString()
  @IsNotEmpty()
  coverLetter!: string;

  get normalizedJobId(): string | undefined {
    if (!this.jobId) return undefined;
    const trimmed = this.jobId.trim();
    if (!trimmed.length) return undefined;
    return trimmed.startsWith('~') ? trimmed : `~${trimmed}`;
  }
}
