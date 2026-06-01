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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenclawController = void 0;
const common_1 = require("@nestjs/common");
const auto_apply_dto_1 = require("./dto/auto-apply.dto");
const openclaw_service_1 = require("./openclaw.service");
let OpenclawController = class OpenclawController {
    openclawService;
    constructor(openclawService) {
        this.openclawService = openclawService;
    }
    async autoApply(dto) {
        const result = await this.openclawService.autoApply(dto);
        return {
            runId: result.raw.runId,
            status: result.raw.status,
            sessionId: result.sessionId,
            sessionKey: result.sessionKey,
            finalText: result.finalText,
            raw: result.raw,
        };
    }
};
exports.OpenclawController = OpenclawController;
__decorate([
    (0, common_1.Post)('auto-apply'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auto_apply_dto_1.AutoApplyDto]),
    __metadata("design:returntype", Promise)
], OpenclawController.prototype, "autoApply", null);
exports.OpenclawController = OpenclawController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [openclaw_service_1.OpenclawService])
], OpenclawController);
//# sourceMappingURL=openclaw.controller.js.map