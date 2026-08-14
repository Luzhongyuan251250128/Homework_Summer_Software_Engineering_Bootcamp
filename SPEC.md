# SPEC.md — 研发任务智能统计与工时分析平台

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 日期 | 2026-08-14 |
| 状态 | 已确认（brainstorming 四节设计全部签字） |
| 项目类型 | 非 harness 应用类项目（Web 数据平台） |
| 关联文档 | `PLAN.md`、`SPEC_PROCESS.md`、`AGENT_LOG.md`、`README.md`、`REFLECTION.md` |

---

## 1. 问题陈述

### 1.1 要解决什么问题

研发团队的管理者（tech lead / PM / 研发主管）每周都要回答三个问题：

1. **这周大家实际投入了多少开发时间？** —— 目前靠成员手动填报或管理者凭印象估算，既失真又耗时。
2. **团队/个人的提交活跃度如何？** —— 没有客观、连续的数据视图。
3. **这个迭代有没有交付风险？** —— 风险往往在迭代末期才暴露（提交骤降、长时间沉默、集中赶工），事后才发现。

Git 是研发过程的真实留痕，但原始 commit 数据零散、跨仓库、无口径，管理者没有工具把它变成可用的管理信息。现有方案要么只做代码托管，不做统计；要么需要手动维护工时表，违背"自动化"的初衷。

### 1.2 目标用户

- **主用户**：研发团队管理者（团队规模 5–30 人，多项目、多仓库）。
- **间接用户**：团队成员（其 commit 数据被聚合，本人可查看个人维度统计）。

### 1.3 为什么值得做

一句话价值：**团队导入 Git 数据，系统自动统计开发工时与代码提交频率，用 LLM 单轮生成周报与迭代风险分析，管理者不用再手动汇总报表。**

- 数据自动采集：接入 Git 托管平台 API，增量同步 commit，免人工汇总。
- 口径可解释：工时由明确定义的估算模型得出，允许人工校正，杜绝"黑箱数字"。
- 报告半自动：LLM 单轮生成草稿 → 人工编辑校对 → 保存历史 → 导出，管理者拿到的是可用的最终稿。

### 1.4 范围声明

- **范围**：Web 端数据平台，含前端；单团队、多项目、多仓库，带迭代维度；Git 数据采集、工时估算统计、LLM 单轮报告生成、报告管理与可视化仪表盘。
- **非范围（YAGNI 明确排除）**：多团队租户隔离与角色权限体系；多用户账号注册登录；自主 Agent 循环（无多轮决策、无工具自主调用、无自我修正）；实时协作编辑；移动端；PR/Issue 深度分析。
- **LLM 使用边界（重要声明）**：LLM 仅做**单轮**生成/摘要（周报、风险分析文案化），无自主循环、无工具自主调用、无据反馈自我修正，**不构成 agent**，按普通功能模块对待与测试。核心统计与风险信号计算全部由确定性代码完成，**移除真实 LLM 后系统仍可作为纯统计平台完整运行**。

---

## 2. 用户故事（INVEST）

> 全部故事独立可交付（I）、可协商（N）、有价值（V）、可估算（E）、足够小（S）、可测试（T）。

**US-1 配置仓库并安全录入 Token**
作为研发管理者，我希望添加 GitHub 仓库并录入访问 Token（隐藏输入），这样系统能自动拉取 commit 数据。
- 验收：能新增/编辑/删除仓库配置；Token 录入时隐藏输入、状态页只显示脱敏指纹（last4）；重复仓库路径被拒绝；删除仓库需二次确认。

**US-2 同步 Git 数据**
作为研发管理者，我希望手动触发"立即同步"（或可选定时），这样 commit 数据能进入系统。
- 验收：同步任务有状态（运行中/成功/失败）与耗时/拉取条数；增量同步幂等（重复同步不产生重复 commit）；Token 失效时任务标记失败且已有数据不受损；失败后可重试。

**US-3 查看团队统计仪表盘**
作为研发管理者，我希望在仪表盘查看团队工时、提交频率、活跃成员与趋势，这样不用手动汇总报表。
- 验收：总览页展示总工时/提交数/活跃成员/趋势图；支持按人/周/迭代维度切换；无数据时显示空状态引导。

**US-4 创建迭代并跟踪迭代统计**
作为研发管理者，我希望创建迭代（名称 + 起止日期）并查看迭代维度的统计，这样能跟踪迭代进度。
- 验收：迭代 CRUD 可用；同项目迭代起止日期不重叠（校验拒绝）；迭代窗口内 commit/工时/频率统计正确聚合。

**US-5 一键生成团队周报**
作为研发管理者，我希望一键生成周报草稿（LLM 单轮），这样节省每周手工写周报的时间。
- 验收：周报按项目或个人维度生成；内容基于指标快照（禁止编造）；无 LLM Key 时明确报错并提示降级；生成失败可重试。

**US-6 编辑报告、保存历史并导出**
作为研发管理者，我希望在线编辑 AI 草稿、保存历史版本并导出 Markdown，这样最终交付的是可用的周报。
- 验收：编辑保存生成新版本；历史版本可回看/恢复；导出 Markdown 内容与最新版本一致；一键复制可用。

**US-7 生成迭代风险分析**
作为研发管理者，我希望对迭代做风险分析（规则引擎信号 + LLM 单轮归因），这样能提前发现交付风险。
- 验收：规则引擎输出确定性风险信号（提交骤降/长沉默/凌晨提交等）；LLM 仅对信号做归因文案；无 LLM 时仍可查看规则信号视图。

---

## 3. 功能规约

> 共 6 个职责清晰的模块。M2/M3/M4 为核心模块（课程要求深度所在），各有独立单测；M1/M5/M6 为支撑模块；认证口令校验为横切关注点。

### M1 项目与迭代管理（配置模块）

- **输入**：项目名称/描述；仓库（平台类型 + 仓库路径 + Token）；迭代（名称 + 起止日期）；管理口令（登录）。
- **行为**：项目/仓库/迭代 CRUD；Token 安全录入（隐藏输入）、查看状态（仅 last4 指纹）、更新、清除；迭代日期重叠校验。
- **输出**：配置持久化到 DB；前端展示同步状态（上次同步时间/状态）。
- **边界条件**：仓库路径在项目内唯一；迭代日期重叠拒绝；Token 为空禁止保存。
- **错误处理**：Token 无效 → 首次同步时报错并保留配置供修改；删除项目级联删除其仓库/迭代/报告（二次确认）。

### M2 Git 数据采集（核心模块①）

- **输入**：仓库配置 + 同步触发（手动"立即同步"按钮 / 可选定时任务）。
- **行为**：
  - 通过抽象 `GitProvider` 接口调用平台 REST API（GitHub 首发，GitLab/Gitee 留适配器扩展）；
  - 按 `since` 增量拉取 commit（分页处理、限流退避）；
  - 规范化：author 邮箱/姓名归一化、时区统一转 UTC 存储；
  - 写入 `commits` 表，按 sha 去重保证幂等；
  - 同步完成后触发工时估算与统计聚合重算。
- **输出**：`sync_runs` 任务记录（状态/耗时/拉取条数/错误信息）；统计指标快照更新。
- **边界条件**：增量同步只拉取 `last_synced_at` 之后的数据；单仓库首次全量同步支持 10k 级 commit；定时任务由 `SYNC_INTERVAL_HOURS` 控制（0 = 关闭，默认关闭）。
- **错误处理**：Token 失效（401）/限流（429）→ 任务失败并记录错误码，不损坏已有数据；网络超时 → 可重试；部分分页失败 → 任务整体标记失败，下次同步从断点继续。

### M3 工时估算与统计（核心模块②）

- **输入**：DB 中的 commit + 迭代窗口。
- **行为**：
  - 按下方『估算口径』对每位开发者每日估算工时；
  - 支持人工校正（`is_corrected=1` 时以 `corrected_hours` 为准，保留原始估算与备注）；
  - 聚合指标：每人/日/周/迭代的提交数、估算工时、活跃天数、凌晨提交占比、单日最大提交等；
  - 输出指标快照供仪表盘与 LLM 使用。
- **输出**：`hours_estimates`、`workday_aggregates`、`iteration_metric_snapshots` 更新。
- **边界条件**：无 commit 的时间段估算为 0；单日跨迭代边界按日归属；全部口径参数集中在 `config.py` 常量，可配置。
- **错误处理**：估算为纯确定性计算，无外部错误路径；人工校正值非法（负数/超上限）→ 校验拒绝。

#### 估算口径（算法定义，M3 核心，全部参数集中于 `config.py`，可配置、可单测）

```
输入：某开发者某日的 commit 序列（committed_at 升序）
1. 活跃段聚类：相邻 commit 时间差 ≤ 90 分钟 → 归入同一活跃段
2. 每段时长 = 段内首末 commit 时间差 + 30 分钟边界修正（封顶 6 小时/段）
3. 当日估算 = Σ(各活跃段时长) × 代码量系数
   代码量系数 = 1.0 + clamp(当日 add+del 行数 / 2000, -0.2, +0.5)
4. 上限：单人单日估算 ≤ 12 小时；非工作日（周六日）估算 × 0.5（周末加班提示）
5. 人工校正：is_corrected=1 时以 corrected_hours 为准，保留原始估算与备注
聚合维度：人 / 日 / 周 / 迭代
```

### M4 LLM 报告生成（核心模块③，单轮、无自主循环）

- **输入**：指标快照 + 报告类型（`weekly` / `risk`）+ 范围（项目/个人；`risk` 类型还需指定迭代）。
- **行为**：
  - 拼装结构化 prompt（系统指令：只依据给定数据、禁止编造；指标快照 JSON；输出 JSON schema 约束）；
  - **单轮**调用 OpenAI 兼容 `/chat/completions`（base URL / 模型可配，默认 DeepSeek）；
  - 解析结构化结果：周报 = 摘要/亮点/风险与阻塞/下周建议；风险分析 = 风险项列表（等级 high/medium/low + 描述 + 数据依据）；
  - 草稿入库，标记 `status=draft`（AI 生成、待人工校对）。

**风险信号清单（规则引擎，确定性计算，参数可配）**——作为风险分析的数据依据喂给 LLM 做归因文案，而非让 LLM 裸算：

```
RS-1 提交频率骤降：近 1 周提交数较前 4 周均值下降 ≥ 50%
RS-2 长沉默期：连续 ≥ 3 个工作日无提交
RS-3 凌晨赶工：0–6 点提交占比 ≥ 30%
RS-4 单日爆量：单日提交数 ≥ 近 4 周日均 3 倍（赶工信号）
RS-5 迭代末期集中：迭代后 1/3 时间窗提交数占比 ≥ 60%
```
> 规则引擎为纯确定性模块，是核心测试对象；无 LLM Key 时页面仍可展示"规则信号视图"。
- **输出**：`reports` 记录（type/scope/content_md/llm_model/status）。
- **边界条件**：无 LLM Key → 明确报错并提示降级为纯统计视图；单次调用超时 60s；不做自动重试注入（失败即报错，由用户重试）。
- **错误处理**：调用失败/超时 → 报告生成失败，已有草稿不丢失；LLM 返回非 JSON → 存原文并标记"未结构化"，页面可查看原文。

### M5 报告管理（编辑/历史/导出）

- **输入**：报告草稿。
- **行为**：Markdown 编辑 + 预览；保存生成新版本（版本号递增）；历史版本回看/恢复；导出 Markdown / 一键复制。
- **输出**：`report_versions` 记录（version/content_md/来源 LLM 或人工/created_at）。
- **边界条件**：并发编辑以最后保存为准（版本递增，不覆盖历史）。
- **错误处理**：导出/复制失败给出提示；恢复历史版本生成新版本而非覆盖当前。

### M6 数据可视化仪表盘（前端）

- **输入**：统计指标快照、同步状态、报告列表。
- **行为**：团队总览（总工时/提交数/活跃成员/趋势图）；个人维度表；迭代进度与风险标记；同步状态卡；报告入口。
- **输出**：ECharts 图表 + 表格 + 统计卡片（自研设计系统「Graphite & Celadon」，见 §8）。
- **边界条件**：无数据 → 空态引导（去配置/去同步）；有数据 → 正常渲染。
- **错误处理**：接口失败 → 加载错误提示 + 重试按钮。

---

## 4. 非功能性需求

### 4.1 性能

- 仪表盘接口 P95 < 300ms（指标快照预聚合，不做实时全表聚合）。
- 全量同步 10k 条 commit 的仓库：单次 < 3 分钟（分页并发受平台限流约束）；增量同步 < 30 秒。
- LLM 报告生成：典型 < 30 秒，页面显示加载态；60s 超时提示。
- SQLite 使用 WAL 模式；查询走索引（sha、committed_at、developer/date 联合索引）。

### 4.2 安全与凭据威胁模型

**威胁模型**

| 编号 | 威胁 | 后果 | 对策 |
|---|---|---|---|
| T1 | Git Token 泄露（硬编码进代码、进日志、明文落库） | 攻击者可读私有仓库 | 密文存储（AES-256-GCM）+ 日志脱敏 + README 自查清单 + CI 凭据扫描 |
| T2 | LLM API Key 泄露/盗刷 | 费用损失 | 环境变量优先；Web 录入时 AES-GCM 密文入库（主密钥派生，仅存 last4 指纹），不进日志；README 明示 `.env` 明文风险 |
| T3 | 未授权访问 WebUI | 泄露 Git 数据与报告 | 管理口令中间件 + 会话；部署层建议加 TLS |
| T4 | 供应链依赖风险 | 依赖投毒 | 锁定依赖版本；CI 依赖审计 |
| T5 | 主密钥丢失 | 所有 Git Token 无法解密 | 录入引导 + README 明示备份策略（keyring / 加密文件） |

**通用安全要求**
- 凭据**绝不硬编码**进源码、绝不提交进 Git（含历史）、绝不写入日志/终端 history/明文配置文件。
- 环境变量从 `.env` 文件加载（不进 shell history），README 说明其明文风险。
- 首次运行引导用户安全录入主密钥（隐藏输入）；查看状态不回显明文。

### 4.3 可用性

- 空状态引导：无项目 → 引导创建；无数据 → 引导同步。
- 同步失败/LLM 失败均有明确错误信息与重试入口。
- 无 LLM Key 时系统正常降级为纯统计平台（所有统计功能可用）。
- 表单即时校验；破坏性操作（删除项目/仓库）二次确认。

### 4.4 可观测性

- 结构化 JSON 日志：请求、同步任务、LLM 调用（仅记录模型/耗时/状态，不记 prompt 全文与 Key）。
- 同步任务表与报告版本记录即审计轨迹。
- `/api/health` 健康检查端点（供部署探针）。

---

## 5. 系统架构

### 5.1 组件图

```
┌──────────────────┐  HTTPS   ┌──────────────────────────────────────┐
│  前端 (浏览器)     │ ───────▶ │  FastAPI 后端 (Python)                │
│  React + Vite    │ ◀─────── │  ├─ REST API 层  /api/*               │
│  自研设计令牌/组件  │          │  ├─ 认证中间件（管理口令 + 会话）        │
│  ECharts         │          │  ├─ Git 采集服务（GitProvider 接口）    │
└──────────────────┘          │  ├─ 工时估算引擎（口径见 §3.3 M3）       │
                              │  ├─ 统计聚合服务（人/周/迭代维度）        │
                              │  ├─ 风险信号规则引擎（确定性）            │
                              │  ├─ LLM 报告服务（OpenAI 兼容，单轮）     │
                              │  ├─ 报告管理服务（编辑/历史/导出）        │
                              │  └─ 定时任务（APScheduler，可选开关）     │
                              └──────────────┬───────────────────────┘
                                             │
                                ┌────────────▼─────────────┐
                                │  SQLite（单文件，WAL 模式） │
                                └──────────────────────────┘

外部依赖：
  ① Git 托管平台 REST API（GitHub 首发；GitLab/Gitee 适配器扩展）
  ② LLM：OpenAI 兼容 /chat/completions（base URL 可配，默认 DeepSeek）
```

### 5.2 数据流（典型闭环）

1. 配置页添加项目/仓库 + Git Token → AES-GCM 加密入库（主密钥派生，见 §7）。
2. 触发同步（手动"立即同步"或可选定时）→ 采集服务按 `since` 增量拉取 commit → 规范化写入 DB。
3. 同步完成后自动重算工时估算与统计聚合，生成指标快照。
4. 管理者点"生成周报/风险分析" → 风险信号规则引擎预计算 → LLM 服务单轮调用 → 草稿入库（`status=draft`）。
5. 报告页内编辑校对 → 保存新版本 → 导出 Markdown / 复制。

### 5.3 外部依赖清单

| 依赖 | 用途 | 说明 |
|---|---|---|
| GitHub REST API | commit 数据采集 | 首发适配器；分页 + 限流处理 |
| OpenAI 兼容 LLM API | 周报/风险分析文案生成 | base URL 可配，默认 DeepSeek；单轮调用 |
| SQLite | 持久化 | 单文件，WAL 模式 |
| （可选）GitLab/Gitee API | 仓库扩展 | 适配器接口预留，非首发 |

---

## 6. 数据模型

### 6.1 实体与字段

```
Team（单例配置）
- id, name, admin_password_hash, created_at

Project
- id, name, description, created_at

Repository
- id, project_id(FK→Project), platform: github|gitlab|gitee,
  repo_path, token_encrypted(AES-GCM 密文), token_last4,
  last_synced_at, created_at

Iteration
- id, project_id(FK→Project), name, start_date, end_date, created_at
  （约束：同项目内日期区间不重叠）

Commit
- id, repository_id(FK→Repository), sha, author_name, author_email,
  committed_at(UTC), add_lines, del_lines, files_changed
  （约束：sha 在 repository 内唯一；索引：committed_at, author_email）

SyncRun
- id, repository_id(FK), status: running|success|failed,
  started_at, finished_at, commits_fetched, error_message

HoursEstimate
- id, developer, date, estimated_hours, is_corrected,
  corrected_hours, correction_note
  （约束：(developer, date) 唯一）

WorkdayAggregate
- id, developer, date, commits, estimated_hours, night_commit_ratio
  （约束：(developer, date) 唯一）

IterationMetricSnapshot
- id, iteration_id(FK→Iteration), developer, commits, estimated_hours,
  metrics_json（提交频率/活跃天数/凌晨占比等）

Report
- id, project_id(FK), iteration_id(FK→Iteration, 可空，仅 risk 类型必填),
  type: weekly|risk, scope: project|developer,
  content_md, status: draft|final, llm_model, created_at

ReportVersion
- id, report_id(FK→Report), version, content_md,
  source: llm|human, created_at

CredentialMeta
- key_name(unique), key_status, updated_at, last4
```

### 6.2 关系与约束

- Project 1—N Repository / Iteration / Report；Repository 1—N Commit / SyncRun。
- 所有外键级联删除（删除项目 → 仓库/迭代/报告一并删除）。
- Token 永不落明文 DB，仅存 AES-GCM 密文 + last4 指纹；主密钥不落盘（keyring / 加密文件）。
- 时间统一 UTC 存储，展示层转本地时区。

---

## 7. 凭据与分发设计

### 7.1 凭据分类与存储

| 凭据 | 存储方式 | 录入/更新/清除 |
|---|---|---|
| Git Token（每仓库） | DB 密文（AES-256-GCM，主密钥派生，iv 随密文存） | Web 隐藏输入；状态页仅 last4；支持更新/清除 |
| LLM API Key | 环境变量 `LLM_API_KEY` 优先；否则 Web 设置页录入，DB 密文（AES-256-GCM，主密钥派生，仅存 last4 指纹） | 环境变量在服务器端 `.env` 配置；Web「配置」页 LLM 设置卡隐藏输入录入/更新/清除（`PUT/DELETE /api/settings/llm`）；缺省时系统降级为纯统计模式 |
| 管理口令 | 环境变量 `ADMIN_PASSWORD` → bcrypt 哈希比对 | 用于登录；口令中间件保护所有 `/api/*` |
| 主密钥 Master Key | 系统钥匙串（`keyring` 库：Windows Credential Manager / macOS Keychain）或用户指定加密文件 | 首次启动引导隐藏录入；不落盘、不回显 |

### 7.2 主密钥生命周期

- **录入**：首次启动未配置 `MASTER_KEY` 环境变量时，CLI 引导隐藏录入 → 存入系统钥匙串或加密文件。
- **使用**：启动时加载，派生 AES-GCM 密钥加密/解密各 Git Token；进程内持有，不写日志。
- **更新/清除**：`clear` 清空某仓库 Token；`update` 重新录入；主密钥丢失即无法解密任何 Token（README 明示风险与备份建议）。

### 7.3 威胁模型与对策（展开）

见 §4.2。核心原则：**密钥材料不进代码、不进 Git 历史、不进日志、不进明文配置；演示与 CI 一律使用 mock LLM server 与假 Token。**

### 7.4 分发形态与目标平台

- **形态**：单 Docker 镜像（OCI）。多阶段构建：前端 `vite build` → 静态资源拷入 FastAPI 镜像，由 FastAPI 同时托管 `/api/*` 与静态页面。
- **启动**：`docker build -t dev-hours . && docker run -p 8080:8000 -e ADMIN_PASSWORD=... -e LLM_API_KEY=... dev-hours`
- **云部署**：Fly.io（免费额度、无需域名备案、全球边缘）为主；README 附 Render 备选方案。
- **已知限制**（README 写明）：单实例单团队；SQLite 单文件（单机部署）；GitHub 平台首发。

### 7.5 目标机 Key 安全配置方式（README 步骤摘要）

1. 复制 `.env.example` → `.env`（不入 Git）。
2. 配置 `ADMIN_PASSWORD`；可选 `MASTER_KEY` / `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`。
3. 首次启动按引导录入主密钥（隐藏输入）→ 存入系统钥匙串。
4. 在 WebUI 录入各仓库 Git Token（隐藏输入），状态页只显示 last4。
5. LLM Key 亦可直接在 WebUI「配置」页 LLM 设置卡录入（隐藏输入，密文入库，仅 last4 指纹）；环境变量 `LLM_API_KEY` 优先级更高，两者皆无时系统降级为纯统计模式。
6. 提交前自查：`.env`、shell history、日志均不得含真实凭据。

### 7.6 CI

- `.gitlab-ci.yml`：`unit-test` job（前端 vitest + 后端 pytest，`make test` 一键运行）+ Docker 镜像构建 job（push 时自动构建）。
- CI 内使用 mock LLM server 与假 Token，无真实凭据。

---

## 8. 技术选型与理由

| 层 | 选型 | 理由 |
|---|---|---|
| 前端框架 | React 18 + Vite + TypeScript | 组件化成熟、生态丰富；Vite 构建快 |
| 设计系统 | **自研设计令牌 + 组件体系**（`tokens.css` 语义令牌 + `components/` 共享组件，无第三方 UI 框架依赖） | 课程推荐路线为 Open Design；本实现**实际采用自研体系**（纠偏，见下方说明）：数据密集型仪表盘需要紧凑密度、表格数字对齐、统一语义色与风险等级可视化，自研令牌零外部耦合、完全可控，且不引入额外依赖；由 `frontend-design` / `design-taste-frontend` skill 指导实施 |
| 图表 | ECharts | 数据平台主流图表库，时间序列/趋势/柱状图开箱即用 |
| 后端 | Python 3.11 + FastAPI + SQLAlchemy | 数据加工/统计在 Python 侧最顺手；FastAPI 异步 + 自动 OpenAPI 文档 |
| 数据库 | SQLite（WAL） | 单文件零运维；可平滑升 Postgres（SQLAlchemy 抽象） |
| LLM | OpenAI 兼容协议，base URL/模型可配，默认 DeepSeek | 国内访问稳定、成本低；测试时替换 base URL 指向 mock server 即可 |
| 后台任务 | APScheduler | 可选定时同步；独立小模块、可单测 |
| 凭据管理 | `keyring`（系统钥匙串）+ AES-256-GCM（`cryptography`） | 满足课程"至少一种安全存储"要求 |
| 分发 | 单 Docker 镜像（OCI） | 一条命令启动；CI 可自动构建 |
| 部署 | Fly.io（主）/ Render（备） | 免费额度、无需备案、可提供公网 URL |
| CI | GitLab CI（`.gitlab-ci.yml`） | 课程交付清单要求，含 `unit-test` job |

**前端 skill 说明（如实纠偏）**：界面开发**实际采用自研设计系统**（体系名「Graphite & Celadon」：语义化 CSS 令牌 `frontend/src/styles/tokens.css` + 共享组件库 `frontend/src/components/`，含 NavLayout / Button / PageHeader / Badge / RiskBadge / FormField / Table / StatCard / EmptyState / TrendChart），不依赖 Open Design 或任何第三方 UI 框架；实施时使用 `frontend-design` 与 `design-taste-frontend` skill 保证界面质量（数据密集仪表盘风格：紧凑统计卡、清晰表格层级、趋势图表、风险信号徽章）。课程推荐路线（Open Design）保留为可选升级方向，本仓库未实际采用。

---

## 9. 验收标准

| 模块 | 客观完成标准 |
|---|---|
| M1 | 项目/仓库/迭代 CRUD 全通过 API 测试；重复仓库被拒；迭代日期重叠被拒；Token 录入/更新/清除流程走通且状态页不回显明文 |
| M2 | fixture 仓库（10k 级 commit 样本 + 分页/限流模拟）增量同步幂等（重复同步 commit 不重复）；Token 失效场景任务标记失败且数据不损坏 |
| M3 | 给定确定性 commit 序列，估算结果与手算一致（精确断言）；人工校正覆盖生效；口径参数可配置 |
| M4 | mock LLM server 返回固定 JSON → 周报/风险分析草稿正确入库；返回垃圾 → 降级路径正确；无 Key → 明确报错 |
| M5 | 编辑保存生成新版本；历史可恢复；导出 Markdown 与最新版本内容一致 |
| M6 | 总览/个人/迭代/报告编辑页在无数据、有数据、错误三种状态下渲染正确 |
| 横切 | `make test` 一键全绿（前端 + 后端）；GitLab CI `unit-test` job pass；`docker run` 冷启动可访问 WebUI；凭据扫描无真实 Key 入库 |

---

## 10. 风险与未决问题

| 编号 | 风险 | 缓解措施 |
|---|---|---|
| R1 | 平台 API 差异（分页/字段） | 抽象 `GitProvider` 接口 + 适配器；GitHub 首发，GitLab/Gitee 按接口扩展 |
| R2 | 工时口径争议（估算 ≠ 真实工时） | 口径可配置 + 人工校正 + README 明示"估算值仅供管理参考" |
| R3 | LLM 输出不可控 | 风险信号由确定性规则引擎预计算，LLM 只做归因文案；prompt 约束 + 结果标注"待校对" + 不自动发布 |
| R4 | 冷启动验证暴露 spec 缺陷 | 按课程流程用陌生 agent 试跑 1–2 个 task，修订 SPEC/PLAN（记录到 `SPEC_PROCESS.md`） |
| R5 | 定时同步与限流冲突 | 定时默认关闭（手动为主）；开启时退避重试 |

**已决问题**：Gitee 适配器不进首发范围（GitHub 先行，接口预留）；定时同步默认关闭（手动为主）。

**未决问题（实现前确认）**：LLM 报告生成的详细 prompt 模板与 JSON schema（进入 PLAN 时定稿）；前端页面清单的最终拆分（总览/个人/迭代/配置/报告编辑五页，进入 PLAN 时细化）。
