"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoApplyDto = void 0;
const class_validator_1 = require("class-validator");
class AutoApplyDto {
    jobId;
    jobUrl;
    coverLetter;
    jobType;
    get normalizedJobId() {
        if (!this.jobId)
            return undefined;
        const trimmed = this.jobId.trim();
        if (!trimmed.length)
            return undefined;
        return trimmed.startsWith('~') ? trimmed : `~${trimmed}`;
    }
    get normalizedJobType() {
        if (!this.jobType)
            return undefined;
        const normalized = this.jobType.trim().toLowerCase();
        if (normalized === 'hourly')
            return 'Hourly';
        if (normalized === 'fixed')
            return 'Fixed';
        return undefined;
    }
}
exports.AutoApplyDto = AutoApplyDto;
__decorate([
    (0, class_validator_1.ValidateIf)((dto) => !dto.jobUrl),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AutoApplyDto.prototype, "jobId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((dto) => !dto.jobId),
    (0, class_validator_1.IsUrl)({ require_tld: true, require_protocol: true }),
    __metadata("design:type", String)
], AutoApplyDto.prototype, "jobUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AutoApplyDto.prototype, "coverLetter", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsIn)(['Hourly', 'Fixed', 'hourly', 'fixed']),
    __metadata("design:type", String)
], AutoApplyDto.prototype, "jobType", void 0);
//# sourceMappingURL=auto-apply.dto.js.map