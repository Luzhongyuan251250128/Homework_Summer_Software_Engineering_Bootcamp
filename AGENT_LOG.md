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

## 2026-08-14 · Phase 2 完成：冷启动验证结果（opencode，worktree `作业-coldstart`）

- **Task 编号**：冷启动验证（课程 §4.5）
- **执行结果**：opencode 全新 session 完成 **T1→T2→T3→T5→T4** 全链 TDD，**27 passed**（主侧复验确认）；分支 `coldstart-task5`，commits `3bd48d8`/`bd822c1`/`3666001`/`5e086b3`/`f07d59f`/`0221567`/`c553335`
- **暂停提问 6 次**（详见 `SPEC_PROCESS.md` §4.2）：依赖链、T5 测试缺陷、环境/plan mode、.gitignore 语义、T4 缺 T3、T3 断言不可达
- **暴露 PLAN 缺陷 4 类**（`SPEC_PROCESS.md` §4.3）：① T5 三测试期望值与 SPEC §3.3/实现矛盾；② T3 `test_login_then_access` 断言 200 不可达（改 404 + 临时 login stub，T9 删除）；③ 测试计数错误（T3/T4/T5 三处）；④ M3 人工校正覆盖缺口（`is_corrected` 无 task 落地 → 补 3 测试，`f07d59f`）
- **规格层判定**：SPEC 口径与实现一致、无需修订；0 次 agent 读错，全部为文档缺陷
- **环境发现**（影响主仓库实现）：pypi 直连不可用→阿里云镜像；`python` 坏 stub→`py`；本机无 make；Python 3.13 下 `datetime.utcnow()` 26 条 DeprecationWarning（技术债）
- **人工干预**：用户与主 agent 共同答复 6 次提问；用户修正过本文件时间戳（1:00 / 3:30）并删除 push 网络问题条目
- **学到的教训**：冷启动 agent 的每次暂停都是修订清单；PLAN 自查必须"重算每个断言"而非只查结构（T5 三缺陷全是手算错误）；事实性字段（时间等）不得自行编造

## 2026-08-14 · Phase 3 启动：冷启动修订移植回主仓库（commit `f6a6ce1`）

- **Task 编号**：Phase 3 前置（非实现 task）
- **触发的技能**：无（文档修订，主 agent 执行）
- **关键操作**：`git checkout c553335 -- PLAN.md`（冷启动已验证的修订版）→ 提交主仓库；diff 核对确认仅含 4 类缺陷修正（T5 三测试 / T3 断言 / 计数×3 / M3 校正覆盖），无夹带改动
- **人工干预**：无（用户批准移植）
- **学到的教训**：跨 worktree 的文档修订用 `git checkout <commit> -- <path>` 从共享对象库直接移植，先 diff 核对范围再提交

## 2026-08-14（时间待用户补充）· Task 1 项目脚手架（Wave 1）

- **触发的技能**：`subagent-driven-development` + `test-driven-development`
- **关键 prompt / context 配置**：worktree `.worktrees/task1`（分支 `task/t1`）；TDD 红-绿-commit；环境适配（`py` 替代 `python`、阿里云 PyPI 镜像、pytest 加 `-p no:cacheprovider`、无 make 用等价命令）
- **subagent 输出**：commit `e128d95`（t1-ds4flash）——10 文件、91 行，与 PLAN 逐字一致；红（`ModuleNotFoundError: No module named 'app'`）→ 绿（1 passed）→ uvicorn 冒烟 `/api/health` 200
- **两阶段评审**：spec 合规 ✅（文件与 PLAN 一致、测试复验绿）；代码质量 ✅ 无 Critical（备注：`admin_password` 占位默认值、本机 `python` 坏 stub 属环境非代码问题）
- **合并**：`fb32486`（--no-ff merge）
- **人工干预**：
  1. 基础设施决策：worktree 从桌面同级改为**工作区内部**（`.worktrees/`，已 gitignore）——subagent 沙箱只允许写会话工作区，嵌套 worktree 实测可写（commit `0e8f32d`）；
  2. 清理 subagent 留下的 4 个沙箱锁定 pytest 垃圾目录（父侧 danger-full-access）；
  3. 解决 `.gitignore` 合并冲突（main 的 `.worktrees/` 行 vs task/t1 的 9 行）——首行为 GBK 编码，采用 git blob 字节级拼接保真合并
- **学到的教训**：① subagent 沙箱写权限决定 worktree 位置，嵌套方案可行且与"每 task 一 worktree"兼容；② 本环境 pytest 统一 `-p no:cacheprovider` 避免沙箱缓存写入残留；③ `.gitignore` 首行 GBK，任何文本工具重写都会损坏，必须字节级操作

## 2026-08-14（时间待用户补充）· 后端实现完成（Task 2~11，Wave 2~5）

- **触发的技能**：`subagent-driven-development` + `test-driven-development`（每 task 一个新鲜 subagent，两阶段评审后 `--no-ff` 合入 main）
- **关键配置**：worktree 嵌套于 `.worktrees/taskN`（沙箱约束）；每 task 独立分支 `task/taskN` + 独立 commit + 评审后 merge
- **task 完成表**（subagent 标识 / commit / merge）：
  - T2 数据层 t2-ds4flash `987c5ba`→`46c08b2`；T3 安全认证 t3-ds4flash `2a06d99`→`78c54f2`
  - T4 Git 采集 t4-ds4flash `503b853`→`d76f739`；T5 估算统计 t5-ds4flash `1ec0375`→`0b32cbb`
  - T6 风险引擎 t6-ds4flash `33b8ab9`→`d3102eb`；T7 LLM 服务 llm-t7 `6db6c69`→`4141db7`
  - T8 报告服务 t8-ds4flash `51177aa`→`f826401`；T9 配置 API t9-ds4flash `9e23621`→`a7e0597`
  - T10 同步统计 sync-stats-impl `f3ef4a5`→`1d7ea9e`；T11 报告 API t11-ds4flash `177acda`→`dcdcaf2`
- **subagent 自主抓出的 PLAN 缺陷（第 6~8 个，待回填）**：
  6. T9 测试计数：PLAN 写 9 passed，其自带代码实际 7+3=10（subagent 按代码原样实现全绿）；
  7. T11 隐藏依赖：PLAN 称"可与 T10 并行"，实际 `reports.py` 顶部 `from .stats import iteration_stats` 依赖 T10 产物 → 调度阻塞一次（父侧补 merge 解阻），PLAN 依赖说明需修正；
  8. T6 test_rs1 迭代窗口缺陷（end=start 致 RS-1 永不触发，已修复，`33b8ab9` 报告确认）。
- **人工干预**：T11 依赖解阻（task7→task11、main→task11 两次 merge，`7ef7160`/`415d629`）
- **学到的教训**：① 派发并行 subagent 前必须核对 PLAN 依赖链的**隐藏** import 依赖（T11↔T10），仅看"可并行"标注不够；② 每个 task 完成后立即在 main 跑全量回归（T11 前 57 passed 基线）确认无回归；③ sync 测试含真实网络超时（~60s），CI 需注意超时预算

## 后续维护占位（实现阶段逐 task 追加）

- [ ] T12~T20 每个 task：完成后追加一条（subagent 标识 / commit hash / 评审发现 / 人工修改）
- [ ] 收尾回填 PLAN：缺陷 6/7/8（T9 计数、T11 依赖说明、T6 test_rs1）+ 前批缺陷核对
