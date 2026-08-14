# AGENT_LOG.md — 研发任务智能统计与工时分析平台

> 按时间顺序记录关键节点（课程 §4.9）。每条包含：时间戳与 task 编号、触发的 Superpowers 技能、关键 prompt / context 配置、subagent 输出的关键片段或 commit hash、人工干预（修改了什么、为什么）、学到的教训。
>
> **维护纪律**：每个阶段/每个 task 完成并通过评审后立即追加一条，并随文档一起 commit；禁止最后批量补记。

---

## 2026-08-14 1:00 · Phase 0：brainstorming → SPEC（commit `8630d84`）

- **Task 编号**：SPEC 阶段（无 task 编号）
- **触发的技能**：`brainstorming`（architectural 路径）
- **关键 prompt / context 配置**：
  - 10 个澄清问题逐一定案：Git 数据来源（平台 API 为主）→ 工时口径（自动估算+人工校正）→ LLM 供应商（OpenAI 兼容+可配 base URL）→ 架构（React+FastAPI+SQLite）→ 管理范围（单团队多项目多仓库+迭代）→ 报告生命周期（生成→编辑→存历史→导出）→ 迭代定义（手动创建）→ 认证（单用户+管理口令）→ 设计系统（Open Design）→ 同步方式（手动为主+可选定时）
  - 设计分 4 节呈现，每节用户签字确认：架构/数据流 → 功能模块/数据模型 → 非功能/工时口径/LLM 细节 → 凭据/分发/验收/风险
- **产出**：`SPEC.md`（10 个必填章节，411 行）
- **人工干预**：spec 自查修复 3 处——① 工时估算口径算法漏写进 SPEC（口头确认的内容未落文）；② 组件图交叉引用错误（指向安全节）；③ `Report` 实体缺 `iteration_id` 外键（风险分析无法追溯到迭代）
- **学到的教训**：对话中确认过的设计细节极易在成文时丢失——每节设计确认后应立即落文，不要等全部确认完再写；数据模型要对照用户故事逐个实体核查关系完整性。

## 2026-08-14 3:30 · Phase 1：writing-plans → PLAN（commit `666b03c`）

- **Task 编号**：PLAN 阶段（20 个 task 规划）
- **触发的技能**：`writing-plans`
- **关键 prompt / context 配置**：TDD 红-绿-重构硬性要求；每 task 含目标/文件/Interfaces 精确签名/真实失败测试代码/验证命令/commit 命令；8 个并行 wave + worktree/PR 对应；执行前置含课程 §4.5 冷启动验证
- **产出**：`PLAN.md`（20 个 task，约 3300 行）
- **人工干预**：计划自查修复 3 处——① T11 测试 monkeypatch 目标错误（`reports_router` → 应为 `llm_service`）；② conftest 内存库需 `StaticPool` 共享连接（否则 API 写入与测试查询不同库）；③ SPEC §4.4 结构化 JSON 日志无对应 task（并入 T18）
- **学到的教训**：跨 task 的类型/签名一致性要在自查时逐项核对（monkeypatch 目标、session 共享、spec 需求→task 映射）；计划里的"注"要写清实现顺序（如先建占位 router 再填充）。



## 2026-08-14 · Phase 2：冷启动验证启动（opencode，隔离 worktree `作业-coldstart` @ `666b03c`）

- **Task 编号**：冷启动验证（课程 §4.5，非实现 task）
- **触发的技能**：无（第二 agent 仅凭 SPEC+PLAN 自主推进；主侧由 brainstorming/writing-plans 产物支撑）
- **关键配置**：独立 worktree（仅 `.gitignore`+`SPEC.md`+`PLAN.md`）；全新 session；指定实现 T5（工时估算），时间允许续 T4；规则"遇到不确定必须暂停提问，禁止猜测"
- **agent 提问与处理**（3 个问题，用户+主 agent 共同应答）：
  1. **依赖问题**：worktree 零代码，T5 依赖 T1/T2 → 答复按方案 1：顺序实现 T1→T2→T5→T4，各 task 独立 commit；T1 的 make test 前端部分按 PLAN 说明跳过
  2. **PLAN 缺陷（重要）**：T5 三个测试（`test_segment_cap_applies` / `test_volume_coefficient` / `test_daily_cap`）与 SPEC §3.3 口径及实现矛盾——**agent 分析正确**：① 09:00/20:00 间隔 11h>90min 不会同段，测不到段封顶；② 代码量系数被 clamp 封顶 +0.5（coef≤1.5），测试却期望 2.0；③ 三段各 3.5h 共 10.5h 够不到 12h 日封顶。处理：按 SPEC 修正测试（实现不动），缺陷待测试结束后回填 PLAN 并记入 SPEC_PROCESS.md（修订 diff）
  3. **环境问题**：opencode 只读 plan 模式 / `python` 是 WindowsApps 假桩 / detached HEAD → 批准执行、建分支 `coldstart-task5`、用 `py -m pytest`；预案：bcrypt==4.2.1 若无 cp313 轮子可在 worktree 内临时升 `bcrypt>=4.3.0` 并记录
- **人工干预**：用户纠正过本文件时间戳为真实时间；删除 push 网络问题条目
- **学到的教训**：① 写 PLAN 测试时"注释里的期望值"必须按口径公式手算一遍（clamp 上限、段间隔拆分、封顶够不够）——三个缺陷全是手算错误；② 冷启动 agent 是 PLAN 质量的客观审计者，其提问清单直接等于修订清单

## 后续维护占位（实现阶段逐 task 追加）

- [ ] 冷启动验证完成：记录 agent 最终报告、PLAN 修订 diff（T5 测试缺陷回填）
- [ ] T1~T20 每个 task：完成后追加一条（subagent 标识 / commit hash / 评审发现 / 人工修改）
