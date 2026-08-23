# MBA_UI

Frontend React 18 + Vite cho nền tảng MBA: đăng nhập SSO, chatbot RAG, quiz,
quản trị chatbot/câu hỏi/người dùng, quản lý tài liệu, học kỳ, ticket và
analytics cho teacher/admin.

## Yêu cầu

- Node.js 18+
- npm 9+
- MBA_BE chạy ở cổng `4559`
- MBA_API chạy ở cổng `4558` nếu gọi trực tiếp RAG trong môi trường local

## Cài đặt và chạy local

```bash
cd MBA_UI
npm ci
npm run dev
```

Vite dev server chạy tại `http://localhost:5000/mini/`.

File `.env` tối thiểu cho local:

```dotenv
# Để trống để dùng same-origin/proxy của Vite.
VITE_API_BASE_URL=

# Proxy local trong vite.config.js
VITE_DEV_PROXY_AUTH_TARGET=http://localhost:4559
VITE_DEV_PROXY_MBA_TARGET=http://localhost:4558

# SSO PTIT
VITE_API_CONNECT_SSO=https://gwdu.ptit.edu.vn/sso/realms/ptit/protocol/openid-connect/auth
VITE_BASE_URL=http://localhost:5000
```

Trong local, request `/auth_mini/*` được proxy tới BE và `/mba_mini/*` tới
MBA_API. Với production same-origin, để `VITE_API_BASE_URL` rỗng và cấu hình
reverse proxy phục vụ frontend cùng domain với các path `/auth_mini` và
`/mba_mini`.

## Build và preview

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 5001
```

Ứng dụng được build với base path `/mini/`. Không truy cập bundle bằng `/` nếu
reverse proxy chưa rewrite đúng base path.

## Docker

Dockerfile hiện build bundle rồi chạy Vite trên cổng `5001`:

```bash
docker build -t mba-frontend .
docker run --rm -p 5001:5001 \
  -e VITE_DEV_PROXY_AUTH_TARGET=http://host.docker.internal:4559 \
  -e VITE_DEV_PROXY_MBA_TARGET=http://host.docker.internal:4558 \
  mba-frontend
```

Nếu dùng workspace đầy đủ:

```bash
docker compose up -d frontend
docker compose logs -f frontend
docker compose up -d --build frontend
```

## Cấu hình SSO

Nút đăng nhập dùng `VITE_API_CONNECT_SSO`; callback là:

```text
${VITE_BASE_URL}/mini/access-auth
```

Client ID mặc định là `ptit-connect`. Redirect URI trên phải được đăng ký trùng
với cấu hình của nhà cung cấp SSO. Authorization code chỉ dùng một lần; khi test
hãy bắt đầu lại từ trang login thay vì refresh URL callback cũ.

## Cấu trúc chính

```text
src/
├── App.jsx                 # Router và route bảo vệ
├── config/api.js           # API endpoint tập trung
├── config/academicTerm.js # Header X-Academic-Term
├── components/             # Chatbot, upload, SSO, ticket...
├── pages/                  # Login, admin, teacher, profile, quiz...
└── utils/                  # Auth và tiện ích dùng chung
```

## Kiểm tra

```bash
npm run build
npm run test:run
```

Build có thể cảnh báo chunk lớn hoặc asset background được resolve lúc runtime;
đây là warning, không phải lỗi nếu command kết thúc với `✓ built`.

## Deploy checklist

1. Đặt đúng `VITE_BASE_URL` và redirect URI SSO.
2. Đảm bảo frontend phục vụ dưới `/mini/`.
3. Đảm bảo proxy `/auth_mini` tới MBA_BE và `/mba_mini` tới MBA_API.
4. Build lại sau mọi thay đổi `VITE_*` vì biến Vite được đóng gói lúc build.
5. Không commit access token, API key hoặc file `.env` production.

## Troubleshooting

- Trang trắng sau SSO: mở DevTools, xoá callback URL cũ và đăng nhập lại từ
  `/mini/login`; kiểm tra callback domain và backend endpoint SSO.
- API 404: kiểm tra base path `/mini/`, proxy Vite và `VITE_API_BASE_URL`.
- Không thấy câu hỏi: kiểm tra kỳ được chọn; ngân hàng câu hỏi dùng chung ở
  `mcq_database.questions` phía BE.
- Thay đổi `.env` không có hiệu lực: dừng dev server và chạy lại `npm run dev`
  hoặc rebuild Docker.
