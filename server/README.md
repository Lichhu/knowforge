# API 开发说明

API 使用 NestJS、PostgreSQL、TypeORM 数据库迁移、HttpOnly Cookie 中的 JWT 会话，以及按被测系统隔离的成员关系和角色。

## 本地启动

1. 在项目根目录启动 PostgreSQL：

   ```sh
   docker compose -f compose.yaml up -d postgres
   ```

2. 将本目录下的 `.env.example` 复制为 `.env`：

   ```sh
   cp server/.env.example server/.env
   ```

   设置唯一的 `JWT_SECRET`（至少 32 个随机字符）、初始管理员邮箱、姓名和至少 12 位的初始密码。模型设置可在确认接口规范后补充。

3. 安装依赖并启动 API：

   ```sh
   npm install
   npm --prefix server install
   npm run dev:api
   ```

只有配置了初始管理员环境变量，API 才会创建初始管理员和“测试管理平台”试点系统。项目不提供默认账户或默认密码。

API 默认地址为 `http://localhost:3000/api`。Web 开发服务器运行在 5173 端口时，Vite 会代理 `/api` 请求。

## 模型适配器

当前适配器按 OpenAI-compatible Chat Completions API 实现，请求地址为：

```text
{AI_BASE_URL}/chat/completions
```

使用 Bearer API Key。请在 `server/.env` 配置 `AI_BASE_URL`、`AI_MODEL` 和 `AI_API_KEY`；不要把密钥提交到代码仓库或发送到聊天中。如果组织内模型接口格式不同，需要根据接口文档调整适配器。

如果使用 OpenCode Go，`AI_BASE_URL` 应设为：

```env
AI_BASE_URL=https://opencode.ai/inference/go/openai/v1
```

后端会在最终请求中自动追加 `/chat/completions`，并发送稳定的 `x-opencode-session` 会话标识。不要使用按量付费路由 `https://opencode.ai/inference/openai/v1` 来消费 Go 套餐额度。DeepSeek V4.1 Flash 还需要在 OpenCode Console 的 **Settings → Privacy → Regions** 中允许 **Global** 区域。

模型提示词只包含当前需求和**同一系统**下已发布的知识。API 会校验模型 JSON 结构，并检查引用是否能在提供的材料中找到。向模型发送真实内部材料前，仍需确认该模型的数据使用、留存和访问策略已获批准。

### 常见上游状态码

- `402`：OpenCode Console 付费请求余额不足、授信额度已用尽或账单逾期；在 Console 的 **Settings → Billing** 检查余额和账单。
- `429`：可能是上游限流或工作区预算达到上限；检查用量与预算策略。
- `401/403`：检查 API Key 是否有效，以及当前账户/工作区是否有权调用所选模型。

需求表单目前支持粘贴文本和填写来源名称，尚未接入 PDF/DOCX 原件上传、解析及对象存储。获批的存储和模型策略确认之前，不要录入敏感材料。

## 初始角色权限

| 角色 | 查看 | 创建/提议 | 确认答案/发布知识 | 管理成员 | 审计 |
|---|---:|---:|---:|---:|---:|
| 管理员 | 是 | 是 | 是 | 是 | 是 |
| 系统负责人 | 是 | 是 | 是 | 仅测试人员 | 是 |
| 测试人员 | 是 | 是 | 审核测试场景 | 否 | 否 |
| 只读审计员 | 是 | 否 | 否 | 否 | 是 |

所有业务记录均按系统成员关系隔离。未登录和无权限的请求会由 API 拒绝；浏览器中显示的角色名称不是授权控制。
