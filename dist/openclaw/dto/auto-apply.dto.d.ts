export declare class AutoApplyDto {
    jobId?: string;
    jobUrl?: string;
    coverLetter: string;
    jobType: string;
    get normalizedJobId(): string | undefined;
    get normalizedJobType(): 'Hourly' | 'Fixed' | undefined;
}
