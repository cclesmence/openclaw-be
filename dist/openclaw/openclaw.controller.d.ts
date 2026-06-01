import { AutoApplyDto } from './dto/auto-apply.dto';
import { OpenclawService } from './openclaw.service';
export declare class OpenclawController {
    private readonly openclawService;
    constructor(openclawService: OpenclawService);
    autoApply(dto: AutoApplyDto): {
        status: string;
    };
}
