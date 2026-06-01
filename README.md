# openclaw-be

API NestJS dùng để giao tiếp với OpenClaw gateway đang chạy local, thay cho việc gõ lệnh qua bot Telegram. Endpoint chính `/auto-apply` sẽ gọi skill `/apply` (được mô tả trong `openclaw-config/agents/main/BOOTSTRAP.md`) để tự động apply job trên Upwork bằng **cover letter do client cung cấp** và **`jobType` cụ thể (Hourly / Fixed)**.

## 1. Thành phần liên quan

- **openclaw-config**: repo cấu hình gốc, chịu trách nhiệm boot Gateway, inject skill `/apply`, và giữ file `openclaw.json` cùng các workspace `.md`.
- **OpenClaw CLI** (`openclaw`): công cụ dòng lệnh để ra lệnh cho Gateway. API này thực chất gọi `openclaw agent --agent <id> --session-key <key> --message "/apply ..." --json`.
- **openclaw-be**: lớp REST nhỏ gọn để hệ thống khác có thể gọi HTTP thay vì chat Telegram.

## 2. Yêu cầu trước khi chạy

1. **Node.js 18+** và npm.
2. Đã chạy `setup.sh` (macOS/Linux) hoặc `setup.ps1` (Windows) trong repo `openclaw-config` để tạo `~/.openclaw` và cài Gateway service.
3. Đã mở Chrome với remote debugging (tham khảo `openclaw-config/README.md`) và đăng nhập Upwork trong profile đó.
4. **Đồng bộ BOOTSTRAP**: luôn copy `openclaw-config/agents/main/BOOTSTRAP.md` sang **cả hai** vị trí:

   ```bash
   cp ~/Documents/openclaw-config/agents/main/BOOTSTRAP.md ~/.openclaw/agents/main/BOOTSTRAP.md
   cp ~/Documents/openclaw-config/agents/main/BOOTSTRAP.md ~/.openclaw/workspace/BOOTSTRAP.md
   ```

   Sau đó restart gateway:

   ```bash
   launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist
   launchctl load  ~/Library/LaunchAgents/ai.openclaw.gateway.plist
   ```

   Kiểm tra lại bằng `diff` để chắc chắn file trùng khớp.
5. **Prime session auto-apply** (một lần):

   ```bash
   openclaw agent --agent main --session-key agent:main:auto-apply \
     --message "Bạn đang chạy local để xử lý /apply Upwork như trong BOOTSTRAP. Khi nhận /apply <job>, hãy làm theo hướng dẫn." \
     --json
   ```

   Điều này giúp session `agent:main:auto-apply` thoát khỏi đoạn onboarding mặc định.
6. Kiểm tra Gateway hoạt động:

   ```bash
   openclaw status --deep
   ```

5. Xác nhận skill `/apply` đang có trong `~/.openclaw/agents/main/BOOTSTRAP.md` (copy từ repo cấu hình).

## 3. Thiết lập dự án này

```bash
npm install
cp .env.example .env   # và chỉnh lại biến môi trường cho phù hợp máy bạn
```

### Biến môi trường chính

| Tên | Ý nghĩa | Giá trị mẫu |
|-----|---------|-------------|
| `OPENCLAW_BINARY` | Tên hoặc path tuyệt đối tới CLI | `openclaw` |
| `OPENCLAW_AGENT_ID` | Agent id được phép chạy skill | `main` |
| `OPENCLAW_SESSION_KEY` | Session key trỏ tới skill `/apply` | `agent:main:auto-apply` |
| `OPENCLAW_TIMEOUT_MS` | Thời gian chờ tối đa cho 1 lần chạy | `600000` (10 phút) |
| `PORT` | Cổng HTTP của NestJS | `3000` |
| `TOOL_JOBS_WEBHOOK_URL` | (Tuỳ chọn) Endpoint trên Railway để nhận notify | `https://tool-jobs.up.railway.app/openclaw` |
| `TOOL_JOBS_WEBHOOK_TOKEN` | (Tuỳ chọn) Bearer token gửi kèm webhook | `super-secret-token` |

> Session key có thể đổi tuỳ cấu hình Gateway. Đảm bảo nó map tới agent/skill giống như khi bạn test bằng Telegram.

## 4. Chạy server

```bash
npm run start:dev
# hoặc
npm run start
```

## 5. API Reference

### `POST /auto-apply`

Gọi skill `/apply` với `jobId` (Upwork job id, tự động thêm tiền tố `~`) **hoặc** `jobUrl` (URL trang apply). Ít nhất một trong hai trường phải có. Ngoài ra:

- `coverLetter` (bắt buộc): nội dung sẽ được agent dán nguyên văn, không generate AI.
- `jobType` (bắt buộc, case-insensitive): `Hourly` hoặc `Fixed` để agent biết form flow nào cần điền.

**Request body**

```json
{
  "jobId": "022057683405563489518",
  "jobType": "Fixed",
  "coverLetter": "Xin chào..."
}
```

Hoặc:

```json
{
  "jobUrl": "https://www.upwork.com/nx/proposals/job/~022057683405563489518/apply/",
  "jobType": "Hourly",
  "coverLetter": "Hello client..."
}
```

**Response (202)**

```json
{
  "runId": "0d8a1089-342b-4c0b-b24d-0a00f0fd2b4d",
  "status": "ok",
  "sessionId": "ffb38c4a-c84d-4d8e-b389-a04d6bfaf08c",
  "sessionKey": "agent:main:auto-apply",
  "finalText": "✅ Applied to job ~022057683405563489518 successfully...",
  "raw": { "...": "trả về đầy đủ JSON từ openclaw agent --json" }
}
```

Trường `raw` giữ nguyên JSON từ CLI để bạn có thể debug nếu skill báo lỗi. Nếu Gateway trả nhiều payload, `finalText` là phần text nối lại theo thứ tự.

> Nếu cấu hình `TOOL_JOBS_WEBHOOK_URL`, service sẽ POST kết quả (thành công hoặc lỗi) đến endpoint Railway của tool-jobs ngay sau khi run nền kết thúc. Payload hiện chỉ bao gồm `status`, `finalText` (đối với success) hoặc `errorMessage`, cộng thêm `commandMessage` để tool-jobs log lại dễ dàng.

## 6. Cơ chế bên trong

1. API nhận request, chạy validation (class-validator) đảm bảo `jobId` hoặc `jobUrl` tồn tại kèm `coverLetter` và `jobType` hợp lệ.
2. Service dựng message `/apply <value> jobType=<Hourly|Fixed>` + block `COVER_LETTER` đúng format skill.
3. Nest spawn `openclaw agent --agent <OPENCLAW_AGENT_ID> --session-key <OPENCLAW_SESSION_KEY> --message "/apply ..." --json`.
4. Kết quả stdout được parse về JSON, gom `payloads[].text` rồi trả lại caller.

## 7. Troubleshooting

- `OpenClaw command timed out`: kiểm tra gateway/logs bằng `openclaw logs --follow` và chắc chắn Chrome remote debugging đang mở đúng profile.
- `openclaw: command not found`: chỉnh `OPENCLAW_BINARY` tới path chính xác (ví dụ `/opt/homebrew/bin/openclaw`).
- Skill không chạy đúng: xác nhận `~/.openclaw/{agents/main,workspace}/BOOTSTRAP.md` giống repo `openclaw-config`, restart gateway, rồi gửi lại lệnh prime session như ở phần yêu cầu.
- Upwork đòi đăng nhập lại: mở Chrome debug profile (xem hướng dẫn ở `openclaw-config/README.md`), đăng nhập thủ công rồi thử lại.
- Muốn xem log chi tiết: dùng `openclaw logs --follow` hoặc `tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log` song song với API request.
- Bị lỗi `pairing required` hoặc `scope upgrade pending approval`: mở Control UI → Devices để approve, hoặc chạy `openclaw pairing approve --device <device_id>`. Sau khi approve một lần, cùng thiết bị sẽ không bị hỏi lại trừ khi yêu cầu scope mới.

## 8. Ghi chú phát triển

- Thêm endpoint khác có thể tái sử dụng `OpenclawService.runAgentCommand(...)` để gửi lệnh tuỳ chọn.
- Có thể đổi `OPENCLAW_SESSION_KEY` để phân tách session giữa API và Telegram.
- Khi cập nhật skill `.md`, nhớ copy lại vào `~/.openclaw/agents/main/` rồi restart gateway theo hướng dẫn `openclaw-config`.

## 9. Expose API qua ngrok

Trong trường hợp bạn cần cho hệ thống bên ngoài gọi `POST /auto-apply` nhưng server đang chạy local, hãy expose thông qua ngrok:

1. Cài `ngrok` và add authtoken (`ngrok config add-authtoken <token>`).
2. Tạo tunnel `openclaw-be` trỏ tới `PORT` bạn đã cấu hình (mặc định 3000) bên trong `~/.config/ngrok/ngrok.yml`.
3. Chạy `ngrok start openclaw-be` để lấy URL HTTPS ổn định, sau đó cập nhật URL cho hệ thống caller.
4. Bảo vệ endpoint bằng API key / auth guard nếu dữ liệu cover letter nhạy cảm.

Chi tiết (bao gồm mẫu `ngrok.yml`, cách gắn hostname cố định và checklist vận hành) nằm trong `NGROK.md`.
