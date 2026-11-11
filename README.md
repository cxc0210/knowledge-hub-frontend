# Knowledge Hub Frontend

基于 Next.js App Router、Tailwind CSS 4 和 shadcn/ui 的 Knowledge Hub 前端。

## 本地运行

```bash
npm install
npm run dev
```

默认访问 <http://localhost:3000>，并通过 `http://127.0.0.1:8000` 连接后端。
如需修改后端地址，复制 `.env.example` 为 `.env.local` 并调整
`BACKEND_API_URL`。

## 路由

- `/`：根据 `kh_access_token` Cookie 跳转到登录页或仪表盘
- `/login`：登录页
- `/dashboard`：受保护的仪表盘页面
- `/user`：受保护的用户管理页面

所有 `/api/*` 请求通过一个 Next.js Catch-all Route Handler 统一代理到后端，
前端组件使用 `services/http.ts` 发起请求，无需为每个后端端点新增 Route Handler。
登录 token 仍使用浏览器不可读取的 HttpOnly Cookie。
