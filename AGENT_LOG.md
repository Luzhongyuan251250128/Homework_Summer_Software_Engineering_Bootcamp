# AGENT_LOG.md — 研发任务智能统计与工时分析平台

> 按时间顺序记录关键节点（课程 §4.9）。每条包含：时间戳与 task 编号、触发的 Superpowers 技能、关键 prompt / context 配置、subagent 输出的关键片段或 commit hash、人工干预（修改了什么、为什么）、学到的教训。
>
> **维护纪律**：每个阶段/每个 task 完成并通过评审后立即追加一条，并随文档一起 commit；禁止最后批量补记。

---

## 2026-08-14 11:00 · Phase 0：brainstorming → SPEC（commit `8630d84`）

- **Task 编号**：SPEC 阶段（无 task 编号）
- **触发的技能**：`brainstorming`（architectural 路径）
- **关键 prompt / context 配置**：
  - 10 个澄清问题逐一定案：Git 数据来源（平台 API 为主）→ 工时口径（自动估算+人工校正）→ LLM 供应商（OpenAI 兼容+可配 base URL）→ 架构（React+FastAPI+SQLite）→ 管理范围（单团队多项目多仓库+迭代）→ 报告生命周期（生成→编辑→存历史→导出）→ 迭代定义（手动创建）→ 认证（单用户+管理口令）→ 设计系统（Open Design）→ 同步方式（手动为主+可选定时）
  - 设计分 4 节呈现，每节用户签字确认：架构/数据流 → 功能模块/数据模型 → 非功能/工时口径/LLM 细节 → 凭据/分发/验收/风险
- **产出**：`SPEC.md`（10 个必填章节，411 行）
- **人工干预**：spec 自查修复 3 处——① 工时估算口径算法漏写进 SPEC（口头确认的内容未落文）；② 组件图交叉引用错误（指向安全节）；③ `Report` 实体缺 `iteration_id` 外键（风险分析无法追溯到迭代）
- **学到的教训**：对话中确认过的设计细节极易在成文时丢失——每节设计确认后应立即落文，不要等全部确认完再写；数据模型要对照用户故事逐个实体核查关系完整性。

## 2026-08-14 11:30 · Phase 1：writing-plans → PLAN（commit `666b03c`）

- **Task 编号**：PLAN 阶段（20 个 task 规划）
- **触发的技能**：`writing-plans`
- **关键 prompt / context 配置**：TDD 红-绿-重构硬性要求；每 task 含目标/文件/Interfaces 精确签名/真实失败测试代码/验证命令/commit 命令；8 个并行 wave + worktree/PR 对应；执行前置含课程 §4.5 冷启动验证
- **产出**：`PLAN.md`（20 个 task，约 3300 行）
- **人工干预**：计划自查修复 3 处——① T11 测试 monkeypatch 目标错误（`reports_router` → 应为 `llm_service`）；② conftest 内存库需 `StaticPool` 共享连接（否则 API 写入与测试查询不同库）；③ SPEC §4.4 结构化 JSON 日志无对应 task（并入 T18）
- **学到的教训**：跨 task 的类型/签名一致性要在自查时逐项核对（monkeypatch 目标、session 共享、spec 需求→task 映射）；计划里的"注"要写清实现顺序（如先建占位 router 再填充）。

## 2026-08-14 11:35 · Phase 2 前置：远程推送尝试

- **Task 编号**：无
- **关键事件**：`git push origin main` 失败：`schannel: SEC_E_NO_CREDENTIALS (0x8009030e)`；排查确认本机**未配置 `credential.helper`**（全局/本地均为空）
- **人工干预**：未改代码；给出两个方案（安装 Git Credential Manager / 使用 PAT 临时推送），由用户本机执行认证
- **学到的教训**：本地 commit 与远程 push 是两件事——先确认 `git config --global credential.helper` 再排查认证问题；环境凭据问题与代码质量无关，不要误改代码。

---

## 后续维护占位（实现阶段逐 task 追加）

- [ ] 冷启动验证（opencode，独立 worktree）：记录 agent 暂停提问清单、spec 缺陷、修订 diff
- [ ] T1~T20 每个 task：完成后追加一条（subagent 标识 / commit hash / 评审发现 / 人工修改）
