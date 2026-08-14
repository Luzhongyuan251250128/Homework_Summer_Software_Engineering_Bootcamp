# SPEC_PROCESS.md — 冷启动验证记录

| 项 | 内容 |
|---|---|
| 验证日期 | 2026-08-14 |
| 验证 agent | deepseek-v4-flash（冷启动：全新 session，仅提供 `SPEC.md` + `PLAN.md`） |
| 验证范围 | 按课程 §4.5 / PLAN.md:4320-4324：实现 Task 5（工时估算）与 Task 4（Git 采集），前置 T1/T2/T3 补齐 |
| 执行分支 | `coldstart-task5`（6 commits：task1/2/3/5/4 + 校正修订） |
| 结论 | **PLAN 测试层存在确定性缺陷（T5 三测试 / T3 断言 / 计数），已修订并验证；SPEC 口径公式与实现一致，无需修订** |

---

## 1. 验证流程与测试结果

严格 TDD（红→绿→commit），每个 task 独立 commit：

| Task | 红（预期失败原因） | 绿 | Commit |
|---|---|---|---|
| T1 脚手架 | `No module named 'app'` | 1 passed | `3bd48d8` |
| T2 数据层 | `app.models` 不存在 | 3 passed | `bd822c1` |
| T3 安全认证 | `app.security` 不存在 | 6 passed（修订后） | `3666001` |
| T5 工时估算+聚合 | `app.services` 不存在 | 8 passed（修订后 11 passed） | `5e086b3` + `f07d59f` |
| T4 Git 采集 | `app.providers` 不存在 | 6 passed | `0221567` |
| 全量回归 | — | **27 passed**（含校正语义修订） | — |

## 2. 暂停/提问记录（6 次，全部获用户答复后继续）

| # | 暂停原因 | 用户决策 |
|---|---|---|
| 1 | T5 依赖 T1/T2，仓库零代码（仅 SPEC/PLAN） | 按 T1→T2→T3→T5→T4 全链 TDD |
| 2 | T5 三测试与自身实现/SPEC §3.3 矛盾 | 修正测试以匹配 SPEC + 实现 |
| 3 | plan mode 阻断 / `python` 为坏 stub / detached HEAD | 建分支 + 用 `py` |
| 4 | `.gitignore` 首行"不允许修改此文件" vs T1 Step 5 | 不修改 .gitignore（显式 `git add` 规避） |
| 5 | T4 测试依赖 T3 的 `app.security.encrypt_token`（原链无 T3） | T3 纳入链路 |
| 6 | T3 `test_login_then_access` 断言 `/api/projects == 200` 不可达（路由属 T9） | 临时 login stub + 断言改 404（用户补充方案，已实施） |

## 3. PLAN 修订 diff（修订前 → 修订后）

### 3.1 T5 测试缺陷（PLAN.md Task 5 Step 1，最严重）

原 3 个测试与 PLAN 自身 Step 3 实现及 SPEC §3.3 口径矛盾，Step 4"PASS"不可达。逐一手算验证：

**`test_segment_cap_applies`**（原 09:00/20:00 相隔 11h → 被 90min 聚类拆为两段各 0.5h=1.0h，期望 6.0 落空）

```diff
-    # 09:00 到 20:00 不间断 → 原始 11h + 0.5h = 11.5h，封顶 6h
-    commits = [commit_at(9, 0), commit_at(20, 0)]
+    # 09:00~16:30 每 90 分钟一个 commit → 同一活跃段：段长 7.5h + 0.5h = 8.0h，封顶 6h
+    commits = [commit_at(9, 0), commit_at(10, 30), commit_at(12, 0),
+               commit_at(13, 30), commit_at(15, 0), commit_at(16, 30)]
```

**`test_volume_coefficient`**（期望 2.0，忽略 SPEC 的 +0.5 封顶；SPEC 公式 = 1.0 + clamp(2000/2000, −0.2, +0.5) = 1.5）

```diff
-    # 09:00-09:30 (1.0h)，当日 add+del = 2000 行 → 系数 1.0+1.0=2.0 → 2.0h
+    # 09:00-09:30 (1.0h)，当日 add+del = 2000 行 → 系数 1.0 + clamp(2000/2000, -0.2, +0.5) = 1.5 → 1.5h
     c1.add_lines, c2.add_lines = 1000, 1000
-    assert estimate_day([c1, c2]) == 2.0
+    assert estimate_day([c1, c2]) == 1.5
```

**`test_daily_cap`**（原数据 6 个 commit 两两间隔 >90min → 六段各 0.5h=3.0h，期望 12.0 落空；注释"三段各 5h"与数据不符）

```diff
-    # 大量提交：三段各 5h（封顶后 3×6=18）→ 日封顶 12h
-    commits = []
-    for h in (8, 13, 18):
-        commits.append(commit_at(h, 0))
-        commits.append(commit_at(h + 3, 0))
+    # 三段：08:00-12:30 (5.0h)、14:30-19:00 (5.0h)、21:00-22:30 (2.0h) → 合计 12.0h → 日封顶 12h
+    commits = [commit_at(8, 0), commit_at(9, 30), commit_at(11, 0), commit_at(12, 30),
+               commit_at(14, 30), commit_at(16, 0), commit_at(17, 30), commit_at(19, 0),
+               commit_at(21, 0), commit_at(22, 30)]
```

### 3.2 T3 断言缺陷（PLAN.md:681 + 注 :835）

`test_login_then_access` 断言 `/api/projects == 200`，但该路由属 T9，T3 阶段不存在；PLAN 注释仅批准临时 login stub，未提 projects。修订：断言改 404（**未认证 401 / 已认证 404** 恰好验证中间件放行），并在 `main.py` 临时加最小 login 路由，`create_app` 补 `app.state.session_secret`（stub 与中间件共用 secret，否则抛 `AttributeError`——用户补充方案中发现并修正）。T9 实现真实路由后删除 stub。

### 3.3 测试计数错误

| 位置 | 修订前 | 修订后 | 实际 |
|---|---|---|---|
| T3 Step 4（PLAN.md:833） | PASS（5 passed） | PASS（6 passed） | security 3 + auth 3 |
| T4 Step 4（PLAN.md:1135） | PASS（5 passed） | PASS（6 passed） | provider 3 + sync 3 |
| T5 Step 4（PLAN.md:1401） | PASS（7 passed） | PASS（11 passed） | 估算 9 + 聚合 2 |

> 其余 task 的计数注释未经验证（如 T7"5 passed"），后续 task 执行时按相同方式核对。

### 3.4 人工校正覆盖缺口（SPEC §9 M3 验收 vs PLAN）

原 PLAN 无任何 task 实现/测试"人工校正覆盖生效；口径参数可配置"（`is_corrected` 仅存在于 T2 模型；T5 `recompute_hours` 无条件覆盖 `estimated_hours`）。修订（commit `f07d59f`）：

- T5 目标与 Interfaces 补充校正语义；
- `recompute_hours`：`is_corrected=1` 行跳过重算（保留原始估算与校正值）；
- `recompute_aggregates`：新增 `_apply_correction`，日聚合与迭代快照以 `corrected_hours` 为准；
- 新增 3 个测试：`test_config_params_affect_estimate`（参数可配）、`test_recompute_hours_preserves_correction`、`test_aggregate_uses_corrected_hours`（TDD 红→绿，全量 27 passed）。

### 3.5 Interfaces 清理

T5 Interfaces 原含"`parse_github_time` 复用"——该函数属 T4，T5 无文件使用，已删除。

## 4. 环境与执行发现

- **pypi.org 不可用**（`/simple/pydantic/` 大页面直连超时，pip 报 `from versions: none`）→ 改用**阿里云镜像** `https://mirrors.aliyun.com/pypi/simple/`，依赖版本锁定不变；TUNA 403。
- `python` 为 WindowsApps 坏 stub（exit 9009）→ 全程 `py`（Python 3.13.5，满足 PLAN 的 ≥3.11）。
- 本机无 `make` → `make test` 以 `py -m pytest` 等价验证（Makefile 已按 PLAN 创建）。
- `datetime.utcnow()` 在 Python 3.13 触发 DeprecationWarning（26 条，不阻塞）；PLAN 面向 3.11 编写，后续可升级为 timezone-aware。
- `.gitignore` 按用户指示未扩展 → 全程显式 `git add` 路径，避免误提交 `.env`/`devhours.db`/`__pycache__`；测试全走内存 SQLite，未产生 `devhours.db`。
- 原始仓库 detached HEAD → 验证分支 `coldstart-task5`。

## 5. 未决/后续事项

1. T6~T20 的测试计数注释（如 T7:1740"5 passed"）未经验证，执行时核对。
2. LLM 报告/API 层对 `corrected_hours` 的消费（T10+）需在后续 task 验证一致性。
3. T3 临时 login stub 在 T9 实现真实路由时删除（PLAN.md:835 注已标记）。
