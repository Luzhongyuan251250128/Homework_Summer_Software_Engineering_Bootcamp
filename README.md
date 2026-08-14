# 研发任务智能统计与工时分析平台

> 30 秒价值：团队导入 Git 数据，系统自动统计开发工时与代码提交频率，用 LLM 单轮生成周报与迭代风险分析，管理者不用再手动汇总报表。

## 功能

- Git 数据采集：GitHub API 增量同步（GitProvider 抽象，GitLab/Gitee 预留扩展）；可选定时同步（APScheduler，默认关闭，手动触发为主）
- 工时估算：时间戳聚类 + 代码量加权口径，支持人工校正
- 统计仪表盘：团队总览 / 个人维度 / 迭代维度，ECharts 趋势图
- LLM 报告（单轮，无自主循环）：周报与迭代风险分析（确定性规则引擎 RS-1~5 + LLM 归因文案）
- 报告管理：编辑 / 版本历史 / 恢复 / 导出 Markdown
- 安全：Git Token / LLM Key AES-256-GCM 密文存储（LLM Key 环境变量优先，或 Web 设置页录入）、管理口令登录

## 目录结构

```
.
├── backend/                          # FastAPI 后端（Python 3.11）
│   ├── app/
│   │   ├── main.py                   # 应用入口：/api/* 路由 + 托管前端静态资源
│   │   ├── config.py                 # Settings：环境变量映射 + 工时估算口径参数
│   │   ├── db.py / models.py / schemas.py    # SQLite(WAL) + SQLAlchemy 数据层
│   │   ├── auth.py / security.py     # 管理口令中间件 / AES-256-GCM Token 加解密
│   │   ├── providers/                # GitProvider 抽象 + GitHub 适配器
│   │   ├── routers/                  # auth / projects / sync / stats / reports
│   │   ├── scheduler.py              # 可选定时同步（APScheduler，默认关闭）
│   │   └── services/                 # sync / estimate / aggregate / risk / llm / report
│   ├── tests/                        # pytest 用例（数据层/认证/同步/估算/风险/报告/API）
│   └── requirements.txt
├── frontend/                         # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── pages/                    # 登录 / 总览 / 个人 / 迭代 / 配置 / 报告编辑
│   │   ├── components/               # 统计卡 / 趋势图 / 空态
│   │   └── api/client.ts             # API 客户端
│   ├── tests/                        # vitest 用例（各页面）
│   └── package.json
├── Makefile                          # make test：一键运行后端 pytest + 前端 vitest
├── .env.example                      # 环境变量模板（复制为 .env，勿提交 Git）
├── SPEC.md / PLAN.md / SPEC_PROCESS.md / AGENT_LOG.md   # 课程文档
└── Dockerfile / .gitlab-ci.yml       # 容器镜像与 CI（见「安装与运行」「分发与 CI」）
```

## 安装与运行（容器分发）

仓库根目录提供多阶段 Dockerfile（前端 `vite build` → 静态资源并入 FastAPI 镜像，由 FastAPI 同时托管 `/api/*` 与静态页面）：

```bash
docker build -t dev-hours .
docker run -p 8080:8000 \
  -e ADMIN_PASSWORD=你的口令 \
  -e MASTER_KEY=你的主密钥 \
  -e SESSION_SECRET=随机串 \
  dev-hours
# 打开 http://localhost:8080
```

- 环境变量与 `backend/app/config.py` 的 Settings 字段一一对应（见 `.env.example`）。
- 如需 LLM 周报/风险分析，追加 `-e LLM_API_KEY=sk-xxx`（环境变量优先级最高）；也可在 WebUI「配置」页 LLM 设置卡录入（主密钥 AES-GCM 密文入库，仅存 last4 指纹）。两者皆无时系统降级为纯统计平台，同步/统计/仪表盘不受影响。

## Key 在目标机器的安全配置（必读）

1. `.env` 从 `.env.example` 复制，**不得提交进 Git**（明文风险：文件与进程环境可见）。
2. `ADMIN_PASSWORD`：登录口令（bcrypt 校验）。
3. `MASTER_KEY`：主密钥，用于 AES-GCM 加密 Git Token。配置方式：优先环境变量 `MASTER_KEY`；未设置时启动会尝试读取系统钥匙串（`keyring`）。首次使用可运行 `python -m app.cli_setup` 以隐藏输入方式录入主密钥并存入系统钥匙串；两者皆无则启动报错。**务必妥善备份主密钥——丢失将无法解密既有 Git Token。**
4. `LLM_API_KEY`：可选。配置方式二选一：a) 环境变量（优先级最高）；b) WebUI「配置」页 LLM 设置卡录入（主密钥 AES-GCM 密文入库，仅存 last4 指纹，可随时清除）。两者皆无时系统降级为纯统计平台。
5. 在 WebUI「配置」页录入各仓库 Git Token（隐藏输入），状态页仅显示 last4 指纹，支持更新/清除。
6. 提交前自查：`.env`、shell history、日志不得含真实凭据。

## 测试

```bash
make test   # 后端 pytest + 前端 vitest，一键全绿
```

## 分发与 CI

- 镜像：`docker build` + `docker run`（见上）；CI（`.gitlab-ci.yml`）`unit-test` job 每次 push 自动跑测试，`build-image` job 构建镜像。
- 云部署：Fly.io（推荐，免费额度）或 Render；部署后公网 URL 见下方「部署」。

## 部署

公网 URL：**（部署完成后填写）** —— 项目当前尚未部署，暂无公网地址；上线后在上一行回填。

## 已知限制

- 单实例单团队（无多租户隔离）；SQLite 单文件（单机部署，可平滑升 Postgres）。
- Git 平台首发 GitHub；GitLab/Gitee 仅预留适配器接口。
- 工时估算为管理参考值，不等于真实工时（口径见 SPEC §3.3）。
- LLM 生成内容需人工校对后定稿。

## 第三方依赖与许可证

后端/前端依赖见 `backend/requirements.txt` 与 `frontend/package.json`；均为各自上游开源许可证（BSD/MIT/Apache-2.0 等），详见各依赖仓库。

## 安全边界

- 凭据不硬编码、不进 Git 历史、不进日志；主密钥丢失将无法解密既有 Git Token 与 Web 录入的 LLM Key。
- 单用户 + 管理口令；公网部署建议在网关层启用 TLS。
