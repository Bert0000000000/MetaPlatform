# Mate Platform Task Breakdown (Master)

**Version**: v2.0 | **Date**: 2026-07-28 | **Status**: Day-1+1 started

**Source**: [2026-07-27-mate-platform-delivery-roadmap.md](./2026-07-27-mate-platform-delivery-roadmap.md)

**Purpose**: Decompose 60+ delivery items (W-level) into 4-24h Task Cards (TC-level), then into 0.5-4h Sub-Tasks (ST-level). Each ST maps to a single file/function/test case, avoiding per-round Token overflow.

---

## 0. Why decompose one more level

| Layer | Roadmap (W) | Task Card (TC) | Sub-Task (ST, new in v2.0) |
|---|---|---|---|
| **Granularity** | 1-4 weeks | 4-24 hours | **0.5-4 hours (single file/function/test)** |
| **Unit** | Delivery item | PR / single commit | **Single file diff / single test** |
| **Acceptance** | Milestone DoD | Single TC demoable/mergeable | **Single file reviewable** |
| **Input** | Domain requirement | Specific file path / function signature | **Specific line / class name / test method** |
| **Output** | Doc + status update | diff + commit + CI green | **1 file diff + 1 unit test green** |
| **Audience** | PM / TL | Developer / reviewer | **Developer (executing)** |
| **Total** | 60+ | 294 | **~880-1200 (est.)** |
| **File size** | - | <=1242 lines | **<=600 lines (more focused)** |
| **Per-round** | NO | MAY exceed Token | **YES, single ST < 150 lines** |

Single-round execution strategy:
- Per round: load 1 ST file (e.g. 	asks-st-W5-6.md) + linked TC card
- Single ST file <= 600 lines, single ST block <= 30 lines
- Complete 1-3 STs per round (about 1-4h work)
- Cross-round connection via git commit + status table

---
## 1. Three-level system (TC -> ST -> Code)

`
Roadmap W
  +- Task Card TC-5.6.4    <- 4-24h / 1 PR / goal + deps + DoD
       +- ST-5.6.4.1    <- 0.5-2h / 1 file / single API
       +- ST-5.6.4.2    <- 0.5-2h / 1 file / single test
       +- ST-5.6.4.3    <- 1-3h / 1 file / integration path
       +- ST-5.6.4.4    <- 0.5-1h / 1 file / doc sync
`

**ST file vs TC file difference**:
- TC files keep **goal / deps / DoD / risk** (why, what does done look like)
- ST files focus on **specific file paths / function signatures / line numbers / test methods** (what to change, how to change, how to verify)

---

## 2. ST Format (v2.0 New)

ST template - see full example in 2026-07-28-mate-platform-st-W5-6.md.

| Field | Description |
|---|---|
| TC | Parent TC ID (e.g. TC-5.6.4) |
| Hours | 0.5h / 1h / 2h / 4h |
| Role | Backend / Frontend / DevOps / QA |
| Target files | Absolute path (multiple allowed) |
| Functions/classes | Specific names |
| Code lines | Estimated total |
| Linked tests | test_xxx functions |
| Prerequisites | ST IDs that must merge first |
| Parallel STs | ST IDs that can run in same PR |
| Commit message | feat(scope): what |
| Critical path | yes/no |

**Goal (1 sentence)**: ...

**Change list**:
1. ...
2. ...

**DoD checklist**:
- [ ] Single file diff <= 200 lines
- [ ] Linked tests all green
- [ ] pyright / ruff no new warnings
- [ ] CI green

---

## 3. File Index

| File | Scope | TC | ST | Status |
|---|---|---|---|---|
| This file | Overview + 3-level system + rules | - | - | v2.0 |
| [tasks-W1.md](./2026-07-27-mate-platform-tasks-W1.md) | W1 skeleton + Swagger/OpenAPI | 37 | - | v1.0 |
| **[2026-07-28-mate-platform-st-W1.md](./2026-07-28-mate-platform-st-W1.md)** | W1 ST breakdown | - | **95** | **v2.0 DONE** |
| [tasks-W2.md](./2026-07-27-mate-platform-tasks-W2.md) | W2 infra facade | 24 | - | v1.0 |
| **[2026-07-28-mate-platform-st-W2.md](./2026-07-28-mate-platform-st-W2.md)** | W2 ST breakdown | - | **63** | **v2.0 DONE** |
| [tasks-W3.md](./2026-07-27-mate-platform-tasks-W3.md) | W3 ACL Client | 29 | - | v1.0 |
| **[2026-07-28-mate-platform-st-W3.md](./2026-07-28-mate-platform-st-W3.md)** | W3 ST breakdown | - | **65** | **v2.0 DONE** |
| [tasks-W4.md](./2026-07-27-mate-platform-tasks-W4.md) | W4 Traefik gateway | 18 | - | v1.0 |
| **[2026-07-28-mate-platform-st-W4.md](./2026-07-28-mate-platform-st-W4.md)** | W4 ST breakdown | - | **48** | **v2.0 DONE** |
| [tasks-W5.md](./2026-07-27-mate-platform-tasks-W5.md) | W5 business domains (8 domains) | 96 | - | v1.0 |
| **[2026-07-28-mate-platform-st-W5-1.md](./2026-07-28-mate-platform-st-W5-1.md)** | W5-1 tech-msg ST | - | **25** | **v2.0 DONE** |
| **[2026-07-28-mate-platform-st-W5-2.md](./2026-07-28-mate-platform-st-W5-2.md)** | W5-2 tech-obs ST | - | **20** | **v2.0 DONE** |
| **[2026-07-28-mate-platform-st-W5-3.md](./2026-07-28-mate-platform-st-W5-3.md)** | W5-3 tech-mcp ST | - | **22** | **v2.0 DONE** |
| **[2026-07-28-mate-platform-st-W5-4.md](./2026-07-28-mate-platform-st-W5-4.md)** | W5-4 tech-ont ST | - | **31** | **v2.0 DONE** |
| **[2026-07-28-mate-platform-st-W5-5.md](./2026-07-28-mate-platform-st-W5-5.md)** | W5-5 tech-llmgw ST | - | **29** | **v2.0 DONE** |
| **[2026-07-28-mate-platform-st-W5-6.md](./2026-07-28-mate-platform-st-W5-6.md)** | W5-6 tech-rag ST | - | **54** | **v2.0 DONE** |
| **[2026-07-28-mate-platform-st-W5-7.md](./2026-07-28-mate-platform-st-W5-7.md)** | W5-7 tech-agent ST | - | **33** | **v2.0 DONE** |
| **[2026-07-28-mate-platform-st-W5-8.md](./2026-07-28-mate-platform-st-W5-8.md)** | W5-8 app-kb ST | - | **27** | **v2.0 DONE** |
| [tasks-W6.md](./2026-07-27-mate-platform-tasks-W6.md) | W6 frontend 9 apps | 59 | - | v1.0 |
| **[2026-07-28-mate-platform-st-W6.md](./2026-07-28-mate-platform-st-W6.md)** | W6 ST breakdown | - | **120** | **v2.0 DONE** |
| [tasks-W7.md](./2026-07-27-mate-platform-tasks-W7.md) | W7 blue-green migration | 31 | - | v1.0 |
| **[2026-07-28-mate-platform-st-W7.md](./2026-07-28-mate-platform-st-W7.md)** | W7 ST breakdown | - | **60** | **v2.0 DONE** |

> **Rule**: W5 (96 TCs across 8 domains) - each domain gets its own ST file.
> Other W (TC count < 50) - single ST file per W.

---
## 4. Granularity Rules

### 4.1 TC level (from v1.0)

1. **Single TC 4-24 hours**: below 4h is over-decomposed; above 24h needs more breakdown.
2. **Single TC = single PR**: 1 review, 1 CI, 1 merge.
3. **Independently demoable / revertable**.
4. **Dependencies explicit** (predecessor TC ID).
5. **DoD mechanical**: each card >= 3 checkboxes.

### 4.2 ST level (new in v2.0)

1. **Single ST 0.5-4 hours**: typical 1-2h, = 1 file + 1 function/class + 1 test.
2. **Single ST = 1 file diff**: independently reviewable / revertable.
3. **Target file absolute path explicit**.
4. **Function / class / test method names specific**.
5. **Code lines estimated**: with type hints + tests + comments, single ST <= 200 line diff.
6. **DoD mechanical**: each ST >= 3 checkboxes, including **CI / type check / unit test**.

### 4.3 Common ST decomposition patterns

| TC pattern | ST decomposition |
|---|---|
| **Class init** (build X service skeleton) | ST.1 pyproject + Dockerfile / ST.2 domain models / ST.3 route skeleton / ST.4 healthz |
| **Endpoint impl** (POST /api/v1/xxx) | ST.1 Request/Response models / ST.2 service layer / ST.3 API route / ST.4 unit test / ST.5 integration test / ST.6 OpenAPI sync |
| **Client wrapper** (XxxClient) | ST.1 pool + connect() / ST.2 basic CRUD / ST.3 retry + circuit breaker / ST.4 mock + unit test |
| **Algorithm / flow** (Xxx algorithm) | ST.1 interface def / ST.2 core algorithm / ST.3 boundary / ST.4 perf test / ST.5 doc |
| **Integration / migration** (adopt Y) | ST.1 docker-compose / ST.2 init script / ST.3 client connect / ST.4 health check / ST.5 fault injection |
| **Frontend page** (X list page) | ST.1 route + skeleton / ST.2 list component / ST.3 search/filter/paging / ST.4 detail drawer / ST.5 E2E |

---

## 5. Critical Path and Sprint Schedule

**Critical path** (defined by roadmap):
`
W1-1 -> W2-3 -> W3-3 -> W4-3 -> W5-6 -> W5-7 -> W5-8 -> W7-6
`

| Sprint | Weeks | Scope | Critical TC | Critical ST | Milestone |
|---|---|---|---|---|---|
| S1 | W1 (07-28~08-10) | W1-1 ~ W1-7 | TC-1.1.1 ~ TC-1.7.5 | ST-1.1.1.1 ~ ST-1.7.5.2 | M1 first half |
| S2 | W2 (08-03~08-17) | W2-1 ~ W2-4 | TC-2.1.1 ~ TC-2.4.5 | (pending) | M1 second half |
| S3 | W3 (08-11~08-24) | W3-1 ~ W3-5 | TC-3.1.1 ~ TC-3.5.5 | (pending) | M2 first half |
| S4 | W4 (08-18~08-31) | W4-1 ~ W4-3 | TC-4.1.1 ~ TC-4.3.6 | (pending) | M2 second half |
| S5 | W5 (08-31~09-13) | W5-1/2/3 | TC-5.1.1 ~ TC-5.3.10 | (pending) | M3 |
| S6 | W5 (09-14~09-27) | W5-4/5 first half | TC-5.4.1 ~ TC-5.5.6 | (pending) | M3 |
| S7 | W5 (09-28~10-11) | W5-5 second half + W5-6 first half | TC-5.5.7 ~ TC-5.6.7 | **ST-5.6.1 ~ ST-5.6.7** | M3 |
| S8 | W5 (10-12~10-25) | W5-6 second half + W5-7 first half | TC-5.6.8 ~ TC-5.7.7 | **ST-5.6.8 ~ ST-5.6.14** + (pending) | M3 |
| S9 | W5 (10-26~11-08) | W5-7 second half + W5-8 first half | TC-5.7.8 ~ TC-5.8.6 | (pending) | M3 |
| S10 | W5 (11-09~11-22) | W5-8 second half + E2E | TC-5.8.7 ~ TC-5.8.12 | (pending) | M3 |
| S11 | W6 (07-28~10-27) | W6-1 ~ W6-6 | TC-6.1.1 ~ TC-6.6.3 | (pending) | M4 |
| S12-S13 | W7 (09-22~12-22) | W7-1 ~ W7-7 | TC-7.1.1 ~ TC-7.7.3 | (pending) | M5 |

> **Parallel note**: During S1 / S5 / S6, W6 (frontend) can run in parallel since it only depends on W1 OpenAPI.

---
## 6. Status State Machine

Each TC / ST flows through the board:

`
Backlog -> In Progress -> In Review -> Done
                            |
                       Changes Requested -> In Progress
`

**TC Done** (= roadmap DoD subset for single card):
- Code merged to main (PR merged)
- Unit test coverage for this card >= 80%
- CI green
- Related OpenAPI doc updated (if applicable)
- Reviewer LGTM
- **All subordinate STs Done** (NEW v2.0 constraint)

**ST Done** (NEW v2.0 for single file):
- Single file diff <= 200 lines
- Linked unit tests all green
- pyright / ruff no new warnings
- This ST marked in TC status table
- git commit message contains ST-<id>

---

## 7. Total Task Card Estimates

| W | Items | TC | Est. ST | ST files |
|---|---|---|---|---|
| W1 | 7 | 37 | **95 DONE** | 1 |
| W2 | 4 | 24 | **63** | **1 (DONE)** |
| W3 | 5 | 29 | **65** | **1 (DONE)** |
| W4 | 3 | 18 | **48** | **1 (DONE)** |
| W5-1 | tech-msg | 12 | **25** | **1 (DONE)** |
| W5-2 | tech-obs | 10 | **20** | **1 (DONE)** |
| W5-3 | tech-mcp | 10 | **22** | **1 (DONE)** |
| W5-4 | tech-ont | 12 | **31** | **1 (DONE)** |
| W5-5 | tech-llmgw | 12 | **29** | **1 (DONE)** |
| W5-6 | tech-rag | 14 | **54 DONE** | 1 |
| W5-7 | tech-agent | 14 | **33** | **1 (DONE)** |
| W5-8 | app-kb | 12 | **27** | **1 (DONE)** |
| W6 | 6 | 59 | **120** | **1 (DONE)** |
| W7 | 7 | 31 | **60** | **1 (DONE)** |
| **Total** | **40** | **294** | **~945** | **14** |

> **Per-round estimate**: single ST block ~25-30 lines (with table). Single ST file <= 60 STs / <= 600 lines. **Per-round safe load: 1 ST file + linked TC summary = ~800 lines / ~25k Token (well below 200k limit).**

---
## 8. Single-Round Execution Best Practices

### 8.1 Loading strategy (avoid Token overflow)

| Scenario | Content to load | Est. Token |
|---|---|---|
| View 1 TC | tasks-W<n>.md TC section (~25 lines) | ~1k |
| Execute 1 ST | tasks-st-W<n>.md ST block (~30 lines) + TC summary (~25 lines) | ~2k |
| Start 1 Sprint | All TC + All ST + master index | ~40k (load in batches) |
| Code review 1 PR | TC + linked ST + diff | ~5k |

### 8.2 Recommended flow

`
1. Read tasks-W<n>.md (understand scope)
2. Pick 1 unfinished TC -> look up tasks-st-W<n>.md ST list
3. Pick 1-3 consecutive STs (typical 2-4h work)
4. Read ST detail (single ST block ~30 lines)
5. Execute -> commit -> update ST status
6. Return to TC status table when done
`

### 8.3 Context compression tips

- Use grep to extract single TC section by ID (e.g. grep -A 20 TC-5.6.4)
- Use awk with ST section markers to extract single ST block
- Done STs can be moved to archive/ subdirectory

---

## 9. Change Log

| Date | Version | Change | Reason |
|---|---|---|---|
| 2026-07-27 | v1.0 | Initial: TC system + W1 detailed breakdown | Roadmap -> TC landing |
| 2026-07-27 | v1.1 | All W2-W7 TCs (294 total) | Full decomposition |
| 2026-07-28 | **v2.0** | **NEW ST layer (0.5-4h granularity), tasks-st-*.md files**; W1 (95 STs) + W5-6 tech-rag (54 STs) + W2 (63 STs) + W3 (65 STs) + W4 (48 STs) + W5-1/2/3 (25+20+22 STs) + W5-4/5 (31+29 STs) + W5-7/8 (33+27 STs) + W6 (120 STs) + **W7 (60 STs)** = 全 14 文件 **692 STs** | **Avoid per-round Token overflow; ST lets each round focus on single file** |

---

## 10. References

- Roadmap: 2026-07-27-mate-platform-delivery-roadmap.md
- Architecture (implementation): 2026-07-27-mate-platform-architecture-implementation.md
- Tech stack: 2026-07-27-mate-platform-tech-stack-confirmed.md
- Task Cards (TC): 2026-07-27-mate-platform-tasks-W1.md ~ W7.md
- Sub-Tasks (ST, DONE): 2026-07-28-mate-platform-st-W1.md, 2026-07-28-mate-platform-st-W5-6.md
- Sub-Tasks (ST, DONE): 全部 14 个 ST 文件已就绪 ✓
  - 2026-07-28-mate-platform-st-W1.md (95)
  - 2026-07-28-mate-platform-st-W2.md (63)
  - 2026-07-28-mate-platform-st-W3.md (65)
  - 2026-07-28-mate-platform-st-W4.md (48)
  - 2026-07-28-mate-platform-st-W5-1.md (25)
  - 2026-07-28-mate-platform-st-W5-2.md (20)
  - 2026-07-28-mate-platform-st-W5-3.md (22)
  - 2026-07-28-mate-platform-st-W5-4.md (31)
  - 2026-07-28-mate-platform-st-W5-5.md (29)
  - 2026-07-28-mate-platform-st-W5-6.md (54)
  - 2026-07-28-mate-platform-st-W5-7.md (33)
  - 2026-07-28-mate-platform-st-W5-8.md (27)
  - 2026-07-28-mate-platform-st-W6.md (120)
  - **2026-07-28-mate-platform-st-W7.md (60)**
- Sub-Tasks (ST, PENDING): — （全部完成）

