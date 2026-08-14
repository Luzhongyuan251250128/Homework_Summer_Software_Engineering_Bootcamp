# SPEC_PROCESS.md — 规约与计划生成过程记录

| 项 | 内容 |
|---|---|
| 文档日期 | 2026-08-14 |
| 状态 | SPEC v1.0 已确认；PLAN v1.0 已确认（含冷启动修订，待回填主仓库） |
| 对应交付物 | `SPEC.md`（commit `8630d84`）、`PLAN.md`（commit `666b03c`） |
| 记录范围 | brainstorming（§4.4）+ writing-plans + 冷启动验证（§4.5） |

---

## 1. 总体过程概述

```
模糊想法（"Git 数据 → 自动统计工时 + LLM 周报/风险分析"）
  → brainstorming（10 个澄清问题逐一定案 + 4 节设计分块签字）→ SPEC.md
  → writing-plans（20 个 TDD task，红-绿-重构）→ PLAN.md
  → 冷启动验证（opencode 全新 session，仅凭 SPEC+PLAN 实现 T1~T5）
      → 暴露 4 类 PLAN 缺陷 → 修订（本文件 §4）
  → 待：修订回填主仓库 PLAN → subagent-driven 实现 T6~T20
```

**关键结论先行**：冷启动验证证明 **SPEC 口径公式与实现一致、无需修订**；缺陷全部集中在 **PLAN 的测试期望值与覆盖缺口**（4 类，见 §4.3）——这正是"规划文档必须可被陌生 agent 执行"的价值体现。

---

## 2. Brainstorming 关键节点（§4.4）

### 2.1 追问了哪些好问题（10 个，一次一题）

| # | 问题 | 用户决策 | 是否修正了原设想 |
|---|---|---|---|
| 1 | Git 数据如何进入系统？ | 平台 API 为主（GitHub 首发） | 否（确认） |
| 2 | 工时用什么口径？Git 里没有"工时"字段 | 自动估算 + 人工校正 | **是**：原设想"自动统计工时"过于理想，被迫接受估算口径 |
| 3 | LLM 供应商？ | OpenAI 兼容 + 可配 base URL（默认 DeepSeek） | 是：原设想未考虑供应商锁定与测试可 mock 性 |
| 4 | 整体架构与部署形态？ | React + FastAPI + SQLite，单 Docker 镜像 | 是：未考虑后台任务在 Next.js 里的别扭，倾向了前后端分离 |
| 5 | 管理范围到哪层？ | 单团队、多项目、多仓库 + 迭代维度 | **是**：排除了多团队 SaaS（YAGNI） |
| 6 | 报告生命周期到哪步？ | 生成→编辑→存历史→导出 | **是**：原设想只有"生成"，补上了人工校对闭环 |
| 7 | "迭代"如何定义？ | 手动创建迭代（名称+起止日期） | 是：排除了"按自然周"（语义弱）与"平台拉取"（兼容性差） |
| 8 | 访问认证？ | 单用户 + 管理口令 | 是：排除了多用户账号体系 |
| 9 | 前端设计系统？ | Open Design（课程导向） | 否（确认） |
| 10 | 数据同步时机？ | 手动立即同步 + 可选定时（默认关） | 是：排除了强制定时 |

**追问质量自评**：Q2/Q5/Q6/Q7 四个问题直接改变了产品边界；若跳过它们，SPEC 会写成"从 Git 数据魔法般得到真实工时"的不可实现文档。Q4 影响技术栈全部后续决策。

### 2.2 关键迭代节选（3 轮以上）

**迭代 1 — 工时口径（Q2）**（用户原方向："自动统计开发工时"）

> 主 agent：Git 数据里其实没有"工时"字段——系统用什么口径把 commit 换算成开发工时？这是核心领域难点。
> 选项：自动估算+人工校正 / 纯时间戳 / 手动填报 / 纯代码量模型。
> 用户：自动估算 + 人工校正（推荐）。
> → 后续在第 3 节设计中落成可单测的算法：90 分钟聚类 + 30 分钟边界修正 + 段封顶 6h + 代码量系数 clamp(±0.5) + 日封顶 12h + 周末 ×0.5。
> **处理决策**：接受估算口径，但强制要求"口径可解释、参数集中于 config、支持人工校正覆盖"，避免"黑箱数字"。

**迭代 2 — LLM 边界与风险分析分工（第 3 节设计）**

> 主 agent：风险分析 = 确定性规则引擎 + LLM 单轮归因——规则引擎算信号、LLM 只做文案化，这个分工是否认可？（这也是"移除 LLM 后仍可确定性验证"的落点）
> 用户：认可。认可。
> → 落成 SPEC §3 M4 的 RS-1~RS-5 清单与"无 LLM Key 降级为纯统计平台"的边界声明。
> **处理决策**：这是本项目"轻度 LLM、无自主 Agent 循环"定位的关键锚点；LLM 只做单轮文案，统计与风险全部确定性代码承担。

**迭代 3 — 凭据与分发（第 4 节设计）**

> 主 agent：主密钥（Master Key）首次启动引导录入 → 钥匙串；Git Token AES-GCM 密文入库、状态页仅 last4；单 Docker 镜像 + Fly.io。
> 用户：确认。并拍板两个未决项：Gitee 不进首发（接口扩展）；定时同步默认关（手动为主）。
> → 落成 SPEC §7 凭据与分发设计与 §10 已决问题。
> **处理决策**：凭据威胁模型（T1~T5）在 SPEC 中明示，README 承载目标机配置步骤——把课程"凭据安全"要求做成可执行流程而非口号。

**迭代 4 — 冷启动缺陷修订（§4.3 详细）**

> opencode：PLAN T5 三个测试与 SPEC §3.3 口径及实现矛盾，Step 4 不可达。
> 主 agent+用户：确认缺陷，按 SPEC 修正测试、实现不动。
> **处理决策**：这是对"规划文档质量"的一次否定式修正——详见 §4。

### 2.3 哪些建议是 AI 提出而被采纳/推翻/修正

**采纳（AI 提出 → 用户接受）**
- OpenAI 兼容 + 可配 base URL（国内访问稳定 + mock 可测）；
- 风险信号由确定性规则引擎预计算、LLM 只做归因（可移除 LLM 验证）；
- 无 LLM Key 时系统降级为纯统计平台；
- 单 Docker 镜像（FastAPI 托管前端静态资源）；
- 手动同步为主 + 可选定时（APScheduler）；
- 手动创建迭代（语义最强、实现可控）。

**推翻 / 修正（AI 建议被用户或后续验证修正）**
- AI 曾把"LLM 定时自动生成报告"列入候选——被修正为"手动一键生成 → 人工编辑 → 存历史 → 导出"闭环（管理者要的是可用的最终稿，不是自动堆砌的草稿）；
- AI 的冷启动执行链 T1→T2→T5→T4 **遗漏了 T3**（T4 声明依赖 `app.security.encrypt_token`）——被 opencode 质疑后修正为 T1→T2→T3→T5→T4；
- AI（本主 agent）在 AGENT_LOG.md 中**编造了时间戳**——被用户以真实时间修正（教训：文档中的事实性字段必须向用户确认，不得自行推断）。

---

## 3. Writing-plans 阶段要点

- 产出 `PLAN.md`：20 个 task、每 task 含目标/文件/Interfaces 精确签名/真实失败测试/验证命令/commit 命令；8 个并行 wave + worktree 对应。
- 计划自查修复 3 处：T11 测试 monkeypatch 目标错误（`reports_router`→`llm_service`）；conftest 内存库需 `StaticPool` 共享连接；SPEC §4.4 结构化日志无对应 task（并入 T18）。
- **不足**：测试期望值未逐一手算验证（详见冷启动暴露的 T5 三测试缺陷）——这是 writing-plans 阶段最该吸取的教训。

---

## 4. 冷启动验证（§4.5，opencode）

> 验证环境：独立 worktree `作业-coldstart`（仅 `.gitignore`+`SPEC.md`+`PLAN.md`，detached HEAD @ `666b03c`）；opencode 全新 session，无任何历史/memory；指定实现 T5（时间允许续 T4）；规则"遇到不确定必须暂停提问，禁止猜测"。完整细节见该 worktree 内 `SPEC_PROCESS.md`（commit `c553335` 附带）。

### 4.1 流程与结果（已在 worktree 复验）

严格 TDD，每 task 独立 commit：

| Task | 红（预期失败原因） | 绿 | Commit |
|---|---|---|---|
| T1 脚手架 | `No module named 'app'` | 1 passed | `3bd48d8` |
| T2 数据层 | `app.models` 不存在 | 3 passed | `bd822c1` |
| T3 安全认证 | `app.security` 不存在 | 6 passed（修订后） | `3666001` |
| T5 估算+聚合 | `app.services` 不存在 | 11 passed（修订后） | `5e086b3`+`f07d59f` |
| T4 Git 采集 | `app.providers` 不存在 | 6 passed | `0221567` |
| 全量回归 | — | **27 passed**（复验确认） | — |

### 4.2 它在哪里暂停并提问（6 次，全部获答复后继续）

| # | 暂停原因 | 处理 |
|---|---|---|
| 1 | T5 依赖 T1/T2，仓库零代码 | 批准全链 T1→T2→T3→T5→T4 |
| 2 | T5 三测试与 SPEC §3.3/自身实现矛盾 | 确认缺陷，修正测试以匹配 SPEC+实现 |
| 3 | plan mode 阻断 / `python` 坏 stub / detached HEAD | 批准执行、建分支 `coldstart-task5`、用 `py` |
| 4 | `.gitignore` 首行中文"不允许修改此文件"语义 | 不修改 .gitignore，显式 `git add` 规避 |
| 5 | T4 依赖 T3（原链无 T3） | 链路补入 T3 |
| 6 | T3 断言 `/api/projects==200` 不可达（路由属 T9） | 临时 login stub + 断言改 404（未认证 401/已认证 404 验证放行） |

### 4.3 暴露的 SPEC/PLAN 缺陷（4 类）与修订 diff 摘要

**缺陷 1（最严重）：T5 三个测试与口径/实现矛盾**（`test_segment_cap_applies` / `test_volume_coefficient` / `test_daily_cap`）
- `test_segment_cap_applies`：09:00/20:00 间隔 11h>90min，会被聚类拆成两段各 0.5h=1.0h，期望 6.0 落空 → 改为 09:00~16:30 每 90 分钟一个 commit（同一段 8.0h→封顶 6h）。
- `test_volume_coefficient`：期望 2.0，忽略 SPEC clamp 上限 +0.5 → 1.0h × 1.5 = 1.5。
- `test_daily_cap`：原 6 commit 两两间隔 >90min → 六段各 0.5h=3.0h，够不到 12h → 改为三段 5h+5h+2h=12h 触顶。

**缺陷 2：T3 `test_login_then_access` 断言 200 不可达**（`/api/projects` 属 T9）
- 修订为断言 404（已认证放行），未认证同路径 401；main.py 临时 login stub 且 `create_app` 先设 `app.state.session_secret`（stub 与中间件共用 secret，否则 `AttributeError`——用户补充方案中发现）；T9 实现真实路由后删 stub。

**缺陷 3：测试计数错误**（T3 "5 passed"→6、T4 "5"→6、T5 "7"→11，已逐项核对；T6~T20 计数未验证，执行时核对）。

**缺陷 4：M3 人工校正覆盖缺口**（SPEC §9 M3 验收"人工校正覆盖生效；口径参数可配置"无 task 落地）
- 原 PLAN 仅 T2 有 `is_corrected` 模型字段，T5 `recompute_hours` 无条件覆盖；
- 修订（commit `f07d59f`）：`recompute_hours` 跳过 `is_corrected=1` 行；`recompute_aggregates` 以 `corrected_hours` 为准；新增 3 个测试（参数可配 / 保留校正 / 聚合用校正值），全量 27 passed。

**spec 写错 vs agent 读错的判定**：6 次暂停中 **0 次属于 agent 读错**（它每次都指对了文档原文）；1 次属于执行环境误解（`.gitignore` 首行语义，agent 保守处理合理）；其余 5 次全部是文档缺陷（2 次 PLAN 测试/断言、1 次链路遗漏、1 次计数、1 次覆盖缺口）。**结论：PLAN 的测试层质量是主要短板，SPEC 口径层可信。**

### 4.4 环境与执行发现（对主仓库后续实现有直接影响）

1. **pypi.org 直连不可用** → 用阿里云镜像 `https://mirrors.aliyun.com/pypi/simple/`，依赖版本锁定不变；TUNA 403。主仓库实现时若装依赖失败，优先切阿里云镜像。
2. `python` 为 WindowsApps 坏 stub → 全程 `py`（Python 3.13.5 ≥ 3.11 要求）。
3. 本机无 `make` → 冷启动用 `py -m pytest` 等价验证；后续主仓库装 make 或直接用 pytest。
4. `datetime.utcnow()` 在 Python 3.13 触发 26 条 DeprecationWarning（不阻塞）——PLAN 面向 3.11 编写，后续可升级 timezone-aware（记入已知技术债）。
5. 全程内存 SQLite，未产生 `devhours.db`；凭据零污染。

---

## 5. 反思（§4.4 要求）

**brainstorming 技能做得好的地方**
1. 一次一题 + 推荐先行：10 个问题每个都有推荐项和理由，用户决策成本极低，且每个决策都落成 SPEC 的明确条目，没有"大概齐"。
2. 分块签字确认：4 节设计逐节确认，Q2/Q5/Q6/Q7 的边界修正发生在写文档之前，避免了成文后返工。
3. YAGNI 执行到位：多团队 SaaS、多用户账号、富文本编辑器、平台里程碑拉取都被显式排除并写入"非范围"。

**让我不满 / 需要改进的地方**
1. **口头确认的内容有落文丢失风险**：工时口径算法差点没写进 SPEC（自查才补上）——设计确认后应立即落文。
2. **AI 会编造事实性字段**：AGENT_LOG 时间戳是编造的，被用户纠正——时间等事实必须向用户确认。
3. **plan 阶段测试期望值必须手算验证**：T5 三测试缺陷全部是"注释里的期望值"没有按口径公式手算导致；冷启动 agent 用一次暂停就抓出了我自查没抓到的错。教训：**计划的自查不能只查结构，要重算每个断言**。
4. 冷启动的价值远超预期：6 次暂停 = 6 份修订清单，其中 M3 覆盖缺口（缺陷 4）是规格层问题——说明"陌生 agent 试跑"是单人项目里最接近同侪评审的机制，后续 T6~T20 执行前应继续保持"遇到不确定即暂停"的纪律。

---

## 6. 待办

- [x] 将冷启动已验证的 PLAN 修订（§4.3 四类缺陷的 diff）回填主仓库 `PLAN.md`（commit `f6a6ce1`）
- [x] 实现阶段全部 task（T1~T20）完成并合入 main，最终回归 **63 passed**
- [x] 实现阶段新增 PLAN 缺陷（#5~#11）记录进 `PLAN.md` 附录 A（commit 见 `PLAN.md` 附录）
- [ ] 用户本机/CI 验证：前端 vitest、docker 冷启动、GitLab CI pipeline、Fly.io 部署 URL
- [ ] 主密钥引导 `app.cli_setup` 已在实现中补上（`aedad3d`）——README 与 `security.py` 错误提示已一致

---

## 附录：实现阶段复盘（2026-08-14，subagent 驱动 20 task）

**流程执行**：每 task 一个新鲜 subagent（独立 worktree `作业/.worktrees/taskN` + 分支 `task/taskN`），严格 TDD 红→绿→commit，父侧两阶段评审（spec 合规→代码质量）后 `--no-ff` 合入 main；subagent 标识与人工修改全部记入 commit message 与 AGENT_LOG。

**subagent 模式的价值（数据）**：实现阶段 subagent 自主抓出 **7 个新的 PLAN 缺陷**（#5~#11，见 PLAN 附录 A.2），全部是"测试期望值与实现/SPEC 不符"或"wave 并行标注与实际 import 依赖矛盾"两类——与我 brainstorm/writing-plans 阶段自查漏掉的 4 个（#1~#4）合计 11 个。**冷启动验证的结论（PLAN 测试层是主要短板）被实现阶段再次证实**。

**方法论反思（追加）**：
1. "可并行"标注必须核对到 import 级依赖（T11↔T10、T14↔T13 各踩一次，均因顶部 import 崩）；
2. 测试 mock 是 PLAN 缺陷高发区（T5×3、T13、T17）：写测试时必须"按实现的实际调用序列/签名逐值核对"，仅核对结构不够；
3. 环境约束（前端 vitest 沙箱不可运行）应提前探测并在 PLAN/AGENT_LOG 统一降级，而非每个 task 各自踩；
4. 分支管理纪律：父侧合入后的分支不应再接收新指令（T12 subagent 重写历史事件，无损害但值得记录）。
