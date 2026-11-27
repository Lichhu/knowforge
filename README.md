# 测试知识工作台

面向银行内部测试团队的 AI 测试设计平台。首期以已有的**测试管理平台**作为试点被测系统，聚焦 Web 端的需求澄清、测试场景设计、人工审核、系统级权限和操作审计；自动化执行列入下一阶段。

## 首期工作流

1. 系统负责人维护被测系统画像，确认后作为同系统 AI 的上下文。
2. 在当前试点系统下创建需求，填写标题并粘贴经授权的需求材料文本。
3. AI 归纳需求、提取材料中的候选事实，并提出待澄清问题。
4. 测试人员可补充问题或记录答案；系统负责人/管理员确认答案。
5. 影响测试预期的问题未确认前，系统阻止生成或审核相应测试场景。
6. AI 根据已确认答案、已确认画像和当前系统已发布知识生成候选场景。
7. 测试人员审核场景；确认后的澄清答案可转为知识草稿，再由负责人审核发布。
8. 需求、画像、角色、审核、AI 生成和知识发布等关键操作都会记录到审计日志。

AI 生成内容不会自动变为业务事实或已发布知识。答案确认、场景审核和知识发布均由授权人员完成。

## 技术栈

- Web：Vue 3、TypeScript、Vite
- API：NestJS、TypeScript
- 数据库：PostgreSQL、TypeORM 迁移
- 身份认证：本地账户 + HttpOnly JWT Cookie；角色按被测系统授权
- AI：可配置的模型适配器，当前按 OpenAI-compatible Chat Completions 接口实现

## 本地开发

### 环境要求

- Node.js 22 或兼容的较新版本
- Docker Compose

### 1. 启动 PostgreSQL

在项目根目录执行：

```sh
docker compose -f compose.yaml up -d postgres
```

Compose 中的数据库账号仅用于本地开发。

### 2. 配置 API 环境变量

复制模板：

```sh
cp server/.env.example server/.env
```

编辑 `server/.env`，至少设置：

```env
JWT_SECRET=替换为至少32字符的随机值
BOOTSTRAP_ADMIN_EMAIL=你的管理员邮箱
BOOTSTRAP_ADMIN_NAME=平台管理员
BOOTSTRAP_ADMIN_PASSWORD=至少12位的初始密码
```

API 首次启动时，会在配置了上述管理员信息的情况下创建初始管理员及“测试管理平台”试点系统。**没有内置默认账号或密码**。已存在的账户不会因修改启动变量而自动重置密码。

模型接口可后续配置：

```env
AI_BASE_URL=模型服务基础地址
AI_API_KEY=模型服务密钥
AI_MODEL=模型名称
```

不要把真实密钥提交到 Git，也不要在聊天中发送密钥。生产环境必须设置 `COOKIE_SECURE=true`，并使用组织批准的密钥管理与模型数据策略。

### 3. 安装依赖

```sh
npm install
npm --prefix server install
```

### 4. 启动 Web 和 API

分别在两个终端运行：

```sh
npm run dev:api
```

```sh
npm run dev
```

访问 <http://localhost:5173>。Vite 会将 `/api` 请求代理到本地 NestJS API（默认端口 3000）。数据库迁移会在 API 启动时自动执行。

## 角色权限

| 角色 | 查看 | 创建需求/问题/答案草稿 | 确认答案/发布知识 | 管理成员 | 查看审计 |
|---|---:|---:|---:|---:|---:|
| 管理员 | 是 | 是 | 是 | 是 | 是 |
| 系统负责人 | 是 | 是 | 是 | 仅可分配测试人员 | 是 |
| 测试人员 | 是 | 是 | 审核测试场景 | 否 | 否 |
| 只读审计员 | 是 | 否 | 否 | 否 | 是 |

权限由 API 校验，不能依赖浏览器中显示的角色。用户只能访问自己被授权的系统数据。

## 当前范围与限制

- 需求材料目前通过粘贴文本录入；PDF/DOCX 文件上传、解析和对象存储尚未接入。
- 模型适配器当前假设接口兼容 `POST {AI_BASE_URL}/chat/completions`，并使用 Bearer API Key。如行内接口格式不同，需要根据接口文档调整适配器。
- OpenCode Console 返回 `402` 时，应检查预付余额、授信额度或逾期账单；`429` 通常是限流或工作区预算限制。
- 使用 OpenCode Go 时，`AI_BASE_URL` 应为 `https://opencode.ai/inference/go/openai/v1`，不要使用按量付费路由。后端会自动附加稳定会话标识。
- SSO、需求文档版本管理，以及 UI/API 自动化执行器尚未完成。
- 自动化执行器按既定范围放在下一阶段；本阶段不在真实被测系统上执行测试。

## 构建

```sh
npm run build
npm run build:api
```

API 的本地启动、迁移和模型接入说明见 [`server/README.md`](server/README.md)。
