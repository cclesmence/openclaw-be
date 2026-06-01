# Hướng dẫn cài đặt và cấu hình ngrok

## 1. Cài đặt

### macOS
```bash
brew install ngrok
```

### Nếu chưa có Homebrew
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Sau đó thêm vào PATH:
```bash
echo >> ~/.zprofile
echo 'eval "$(/opt/homebrew/bin/brew shellenv zsh)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv zsh)"
```

---

## 2. Tạo tài khoản và lấy authtoken

1. Vào https://ngrok.com → **Sign Up** → **Continue with GitHub**
2. Sau khi đăng nhập vào dashboard → vào https://dashboard.ngrok.com/authtokens
3. Copy authtoken rồi chạy:

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN
```

---

## 3: Chạy ngrok

```bash
ngrok http 3000
```

---
