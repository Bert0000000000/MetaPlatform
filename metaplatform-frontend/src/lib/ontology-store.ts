/**
 * 本体引擎 — 业务实例 store (P2P 采购场景)
 *
 * 设计:
 *  - 全局单例, 跨页面共享
 *  - 内存 mock, 不依赖后端
 *  - 每个 method 都会 emit ontology event
 *  - 真实可触发: 提交 PR → 校验规则 → 触发 action → 创建 PO
 *    整条链路在内存中真实推进, 事件流实时记录
 *
 * 流程 (P2P Purchase-to-Pay):
 *   Supplier → PR → [审批: rule 校验] → PO → GoodsReceipt → Invoice → Payment
 *
 * 演示动作:
 *  - 提交新 PR (随机供应商, 随机金额)
 *  - 审批 PR (按规则)
 *  - 自动转 PO
 *  - 创建收货
 *  - 触发规则: 金额阈值 / 库存不足 / 过期提醒
 */
import { ontologyBus, type ObjectKind, type OntologyEvent } from "./ontology-eventbus";

/* ──────── Object 实例 (业务数据) ──────── */
export interface Supplier {
  id: string;
  code: string;
  name: string;
  rating: "A" | "B" | "C";
  region: string;
  paymentTerms: string;
  onTimeRate: number;       // %
}

export interface PurchaseRequest {
  id: string;
  prNo: string;             // PR-2026-xxxx
  title: string;
  supplierId: string;
  requester: string;
  amount: number;
  status: "草稿" | "待审批" | "已批准" | "已驳回";
  createdAt: string;
  category: string;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  prId?: string;            // 来源 PR
  supplierId: string;
  amount: number;
  status: "待发货" | "已发货" | "已收货" | "已关闭";
  createdAt: string;
  expectedDate: string;
}

export interface GoodsReceipt {
  id: string;
  grNo: string;
  poId: string;
  receivedQty: number;
  status: "已签收" | "待质检" | "合格" | "不合格";
  receivedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  poId: string;
  amount: number;
  status: "待匹配" | "已匹配" | "已付款" | "异常";
  issuedAt: string;
}

/* ──────── Store ──────── */
class OntologyStore {
  suppliers: Supplier[] = [
    /* ── 核心供应商 (无重复, 是主数据权威源) ── */
    { id: "sup-001", code: "S001", name: "上海精密机械有限公司", rating: "A", region: "华东", paymentTerms: "Net 30", onTimeRate: 98 },
    { id: "sup-002", code: "S002", name: "华耀电子科技股份有限公司", rating: "A", region: "华南", paymentTerms: "Net 60", onTimeRate: 95 },
    { id: "sup-003", code: "S003", name: "北辰建材集团", rating: "B", region: "华北", paymentTerms: "Net 45", onTimeRate: 87 },
    { id: "sup-004", code: "S004", name: "蓝海物流服务有限公司", rating: "B", region: "西南", paymentTerms: "Net 30", onTimeRate: 92 },
    { id: "sup-005", code: "S005", name: "易达办公用品", rating: "C", region: "华东", paymentTerms: "COD", onTimeRate: 78 },

    /* ── 重复 (用户/历史导入产生, 需去重) ── */

    // 重复组 1: sup-001 的 3 个变体 (漏掉"有限公司" / 全角括号 / 简称)
    { id: "sup-101", code: "S001-OLD", name: "上海精密机械", rating: "A", region: "华东", paymentTerms: "Net 30", onTimeRate: 96 },
    { id: "sup-102", code: "S001-DUP", name: "上海精密机械(集团)", rating: "A", region: "华东", paymentTerms: "Net 30", onTimeRate: 98 },
    { id: "sup-103", code: "SHJM",     name: "上海精密",         rating: "A", region: "华东", paymentTerms: "Net 30", onTimeRate: 97 },

    // 重复组 2: sup-002 的 2 个变体
    { id: "sup-201", code: "HY-TECH",  name: "华耀电子",         rating: "A", region: "华南", paymentTerms: "Net 60", onTimeRate: 95 },
    { id: "sup-202", code: "HY-DZ",    name: "华耀电子科技股份", rating: "A", region: "华南", paymentTerms: "Net 60", onTimeRate: 95 },

    // 重复组 3: sup-003 的 1 个变体 (不同名但同 code)
    { id: "sup-301", code: "S003",     name: "北辰建材股份",     rating: "B", region: "华北", paymentTerms: "Net 45", onTimeRate: 87 },

    // 重复组 4: sup-004 的 1 个变体
    { id: "sup-401", code: "BLWL",     name: "蓝海物流",         rating: "B", region: "西南", paymentTerms: "Net 30", onTimeRate: 92 },

    // 独立新供应商 (无重复, 真实存在)
    { id: "sup-501", code: "S501",     name: "卓越软件",         rating: "A", region: "华东", paymentTerms: "Net 30", onTimeRate: 99 },
  ];

  purchaseRequests: PurchaseRequest[] = [
    { id: "pr-001", prNo: "PR-2026-0142", title: "生产部 3 月办公设备采购", supplierId: "sup-005", requester: "张伟", amount: 18_400, status: "已批准", createdAt: "2026-07-01", category: "办公设备" },
    { id: "pr-002", prNo: "PR-2026-0143", title: "研发中心服务器扩容", supplierId: "sup-002", requester: "李娜", amount: 86_500, status: "待审批", createdAt: "2026-07-04", category: "IT 硬件" },
    { id: "pr-003", prNo: "PR-2026-0144", title: "市场部 Q3 推广物料", supplierId: "sup-005", requester: "王芳", amount: 8_200, status: "已批准", createdAt: "2026-07-05", category: "市场" },
    { id: "pr-004", prNo: "PR-2026-0145", title: "行政部 7 月饮用水", supplierId: "sup-005", requester: "陈强", amount: 1_280, status: "草稿", createdAt: "2026-07-07", category: "日常" },
  ];

  purchaseOrders: PurchaseOrder[] = [
    { id: "po-001", poNo: "PO-2026-0912", prId: "pr-001", supplierId: "sup-005", amount: 18_400, status: "已发货", createdAt: "2026-07-02", expectedDate: "2026-07-15" },
    { id: "po-002", poNo: "PO-2026-0913", prId: "pr-003", supplierId: "sup-005", amount: 8_200, status: "待发货", createdAt: "2026-07-06", expectedDate: "2026-07-20" },
  ];

  goodsReceipts: GoodsReceipt[] = [
    { id: "gr-001", grNo: "GR-2026-0231", poId: "po-001", receivedQty: 50, status: "合格", receivedAt: "2026-07-08" },
  ];

  invoices: Invoice[] = [
    { id: "inv-001", invoiceNo: "INV-2026-1102", poId: "po-001", amount: 18_400, status: "已匹配", issuedAt: "2026-07-09" },
  ];

  /* ──────── 业务规则 (P2P 流程内置) ──────── */
  rules = {
    /** 规则 R-001: 金额 >= 50000 必须总监审批 */
    requireDirectorApproval: (amount: number): boolean => amount >= 50_000,
    /** 规则 R-002: 供应商等级 C 限制单笔金额 <= 10000 */
    limitLowRatingSupplier: (supplier: Supplier, amount: number): boolean =>
      supplier.rating === "C" && amount > 10_000,
    /** 规则 R-003: PR 标题不能为空 */
    requireNonEmptyTitle: (title: string): boolean => title.trim().length === 0,
  };

  /* ═════════ ACTION: 提交新 PR ═════════
     真实可触发:
       1. 校验规则 R-003 (标题)
       2. 选择规则 R-001 / R-002 进行评估
       3. 触发 object.created
       4. 触发规则事件
       5. 若规则违反 → emit alert.raised
  */
  submitPurchaseRequest(input: { title: string; supplierId: string; requester: string; amount: number; category: string }): {
    ok: boolean;
    pr?: PurchaseRequest;
    violations: string[];
  } {
    const violations: string[] = [];

    // R-003 标题非空
    if (this.rules.requireNonEmptyTitle(input.title)) {
      violations.push("R-003: PR 标题不能为空");
    }

    const supplier = this.suppliers.find((s) => s.id === input.supplierId);
    if (!supplier) {
      violations.push("供应商不存在");
    } else {
      // R-002 低等级供应商
      if (this.rules.limitLowRatingSupplier(supplier, input.amount)) {
        violations.push(
          `R-002: 供应商 ${supplier.name} 等级为 C, 单笔超过 ¥10,000 需走特殊审批`,
        );
      }
    }

    // R-001 金额阈值
    if (this.rules.requireDirectorApproval(input.amount)) {
      violations.push(
        `R-001: 金额 ¥${input.amount.toLocaleString()} ≥ ¥50,000, 必须由总监审批`,
      );
    }

    // 触发动作事件
    ontologyBus.emit({
      type: "action.executed",
      level: "info",
      message: `执行动作: 提交采购申请 — ${input.title}`,
      payload: { input, violations },
    });

    // 规则触发
    violations.forEach((v) => {
      ontologyBus.emit({
        type: "rule.violated",
        level: "warning",
        message: v,
        payload: { input, rule: v.split(":")[0] },
      });
    });

    // 告警
    if (violations.length > 0) {
      ontologyBus.emit({
        type: "alert.raised",
        level: "warning",
        message: `新 PR 提交触发 ${violations.length} 条规则, 需关注`,
        payload: { input, violations },
      });
    }

    // 创建对象
    const id = `pr-${String(this.purchaseRequests.length + 1).padStart(3, "0")}`;
    const prNo = `PR-2026-${String(143 + this.purchaseRequests.length).padStart(4, "0")}`;
    const pr: PurchaseRequest = {
      id,
      prNo,
      title: input.title,
      supplierId: input.supplierId,
      requester: input.requester,
      amount: input.amount,
      status: "待审批",
      createdAt: new Date().toISOString().slice(0, 10),
      category: input.category,
    };
    this.purchaseRequests.unshift(pr);

    ontologyBus.emit({
      type: "object.created",
      level: "success",
      message: `新建对象: ${prNo} — ${pr.title} (¥${pr.amount.toLocaleString()})`,
      payload: { objectKind: "PurchaseRequest" as ObjectKind, pr },
    });

    return { ok: violations.length === 0, pr, violations };
  }

  /* ═════════ ACTION: 审批 PR ═════════
     流程编排 (workflow):
       workflow.started
       → workflow.step (校验规则)
       → workflow.step (状态变更)
       → 若 PR 金额 >= 50k → 路由到"总监审批"队列, 仅 state 变更
       → 若通过 → 触发 action "转 PO" (自动)
       → workflow.completed
  */
  approvePurchaseRequest(prId: string, approver: string, comment: string): { ok: boolean; po?: PurchaseOrder } {
    const pr = this.purchaseRequests.find((p) => p.id === prId);
    if (!pr) return { ok: false };
    if (pr.status !== "待审批") return { ok: false };

    const wfId = `wf-${Date.now()}`;
    ontologyBus.emit({
      type: "workflow.started",
      level: "info",
      message: `流程启动: 审批 ${pr.prNo} (审批人: ${approver})`,
      payload: { workflowId: wfId, prId, approver },
    });

    // Step 1: 校验规则
    ontologyBus.emit({
      type: "workflow.step",
      level: "info",
      message: `Step 1/3: 校验业务规则`,
      payload: { workflowId: wfId, step: 1 },
    });

    if (this.rules.requireDirectorApproval(pr.amount) && !comment.includes("总监")) {
      // 没附"总监"字样 → 拒绝, 转人工
      pr.status = "已驳回";
      ontologyBus.emit({
        type: "rule.violated",
        level: "error",
        message: `规则 R-001 拒绝: 金额 ¥${pr.amount.toLocaleString()} 需总监审批, 审批意见需含"总监"`,
        payload: { prId, rule: "R-001" },
      });
      ontologyBus.emit({
        type: "alert.raised",
        level: "error",
        message: `PR ${pr.prNo} 被驳回 — 缺总监审批`,
        payload: { prId },
      });
      ontologyBus.emit({
        type: "workflow.completed",
        level: "error",
        message: `流程终止: ${pr.prNo} 被驳回`,
        payload: { workflowId: wfId, result: "rejected" },
      });
      return { ok: false };
    }

    // Step 2: 状态变更
    ontologyBus.emit({
      type: "workflow.step",
      level: "info",
      message: `Step 2/3: 变更状态 待审批 → 已批准`,
      payload: { workflowId: wfId, step: 2 },
    });
    pr.status = "已批准";
    ontologyBus.emit({
      type: "object.updated",
      level: "success",
      message: `更新对象: ${pr.prNo} 状态变为 已批准`,
      payload: { objectKind: "PurchaseRequest" as ObjectKind, pr },
    });

    // Step 3: 自动转 PO
    ontologyBus.emit({
      type: "workflow.step",
      level: "info",
      message: `Step 3/3: 自动转采购订单 (服务编排)`,
      payload: { workflowId: wfId, step: 3 },
    });

    const po = this._createPOFromPR(pr);

    ontologyBus.emit({
      type: "workflow.completed",
      level: "success",
      message: `流程完成: ${pr.prNo} → ${po.poNo}`,
      payload: { workflowId: wfId, result: "approved", poId: po.id },
    });

    return { ok: true, po };
  }

  /* ═════════ ACTION: 触发"规则违反"演示 ═════════
     不创建对象, 仅触发规则事件 (用于演示)
  */
  simulateRuleViolation(): { rule: string; message: string }[] {
    const samples: { rule: string; message: string }[] = [
      { rule: "R-004", message: "库存低于安全水位: SKU-A123 当前 12, 安全水位 50" },
      { rule: "R-005", message: "供应商资质过期: S003 北辰建材 营业执照 7 天后到期" },
      { rule: "R-006", message: "PO 超期未到货: PO-2026-0888 预计 2026-07-05 到达, 至今未签收" },
    ];
    samples.forEach((s) => {
      ontologyBus.emit({
        type: "rule.violated",
        level: "warning",
        message: `${s.rule}: ${s.message}`,
        payload: { rule: s.rule },
      });
    });
    ontologyBus.emit({
      type: "alert.raised",
      level: "warning",
      message: `批量巡检发现 ${samples.length} 条规则违反`,
      payload: { count: samples.length },
    });
    return samples;
  }

  /* ── 内部: 由 PR 自动创建 PO ── */
  private _createPOFromPR(pr: PurchaseRequest): PurchaseOrder {
    const id = `po-${String(this.purchaseOrders.length + 1).padStart(3, "0")}`;
    const poNo = `PO-2026-${String(914 + this.purchaseOrders.length).padStart(4, "0")}`;
    const expected = new Date();
    expected.setDate(expected.getDate() + 14);
    const po: PurchaseOrder = {
      id,
      poNo,
      prId: pr.id,
      supplierId: pr.supplierId,
      amount: pr.amount,
      status: "待发货",
      createdAt: new Date().toISOString().slice(0, 10),
      expectedDate: expected.toISOString().slice(0, 10),
    };
    this.purchaseOrders.unshift(po);
    ontologyBus.emit({
      type: "action.executed",
      level: "info",
      message: `执行动作: 自动转 PO (服务编排) — ${pr.prNo} → ${poNo}`,
      payload: { po },
    });
    ontologyBus.emit({
      type: "object.created",
      level: "success",
      message: `新建对象: ${poNo} (¥${po.amount.toLocaleString()})`,
      payload: { objectKind: "PurchaseOrder" as ObjectKind, po },
    });
    return po;
  }

  /* ═══════════════════════════════════════════════════════
     本体对象去重校验
     业务问题: 同一供应商因手工录入/Excel 导入/SAP 同步产生多份
       "上海精密机械" / "上海精密机械有限公司" / "上海精密机械(集团)"
       评级/账期相同但 code 不同, 算 3 条独立供应商 — 重复

     去重策略 (3 个信号, 任一命中即归并):
       1. code 精确相同 (强)
       2. name 归一化后双向包含 (中, 默认采用)
       3. region + rating + name 前缀同 (弱, 仅做提示)

     归一化 (normalizeName):
       - 去全角 → 半角
       - 去 "有限公司" "股份有限公司" "集团" "股份" 等公司后缀
       - 去空格/标点/括号
       - 转小写
     ═══════════════════════════════════════════════════════ */

  /**
   * 把公司名归一化成可比较的 key
   * 例: "上海精密机械(集团)" → "上海精密机械"
   *     "华耀电子科技股份有限公司" → "华耀电子科技"
   */
  private normalizeName(name: string): string {
    return name
      .replace(/（/g, "(").replace(/）/g, ")")
      .replace(/[()（）【】\[\]·]/g, "")
      .replace(/(有限公司|股份有限公司|股份有限|有限公司|集团|股份|有限责任|公司|企业|工厂)$/g, "")
      .replace(/\s+/g, "")
      .toLowerCase()
      .trim();
  }

  /**
   * 找出 supplier 列表里的重复组
   * 返回 [{ key, reason, members: Supplier[] }]
   */
  findDuplicateSuppliers(): { key: string; reason: string; members: Supplier[] }[] {
    const groups: { key: string; reason: string; members: Supplier[] }[] = [];
    const used = new Set<string>();

    this.suppliers.forEach((s1, i) => {
      if (used.has(s1.id)) return;
      const group: Supplier[] = [s1];
      const reasons = new Set<string>();

      this.suppliers.forEach((s2, j) => {
        if (j <= i || used.has(s2.id)) return;
        // 信号 1: code 精确相同
        if (s1.code && s1.code === s2.code) {
          group.push(s2);
          reasons.add(`code 相同: ${s1.code}`);
          return;
        }
        // 信号 2: name 归一化后双向包含
        const n1 = this.normalizeName(s1.name);
        const n2 = this.normalizeName(s2.name);
        if (n1 && n2 && (n1.includes(n2) || n2.includes(n1))) {
          group.push(s2);
          reasons.add(`名称相似: "${s1.name}" ≈ "${s2.name}"`);
        }
      });

      if (group.length > 1) {
        group.forEach((g) => used.add(g.id));
        groups.push({
          key: `grp-${s1.id}`,
          reason: [...reasons].join(" / "),
          members: group,
        });
      }
    });

    return groups;
  }

  /**
   * 合并一组重复, 保留 targetId 主记录, 删除其他, 迁移关联引用
   * 真实可触发:
   *   - 更新所有引用 oldId 的地方 (PR/PO/GR/Invoice 里的 supplierId)
   *   - 删除重复条目
   *   - emit object.updated (主记录) + object.deleted (从记录)
   */
  mergeSupplierDuplicates(group: { key: string; members: Supplier[] }, targetId: string): {
    merged: number;
    updated: number;
    deletedIds: string[];
  } {
    const target = this.suppliers.find((s) => s.id === targetId);
    if (!target) return { merged: 0, updated: 0, deletedIds: [] };

    const toDelete = group.members.filter((m) => m.id !== targetId);
    if (toDelete.length === 0) return { merged: 0, updated: 0, deletedIds: [] };

    // 迁移 PR 里的 supplierId 引用
    let updated = 0;
    toDelete.forEach((old) => {
      this.purchaseRequests.forEach((pr) => {
        if (pr.supplierId === old.id) {
          pr.supplierId = targetId;
          updated++;
        }
      });
      this.purchaseOrders.forEach((po) => {
        if (po.supplierId === old.id) {
          po.supplierId = targetId;
          updated++;
        }
      });
    });

    // 删除重复条目
    const deletedIds: string[] = [];
    toDelete.forEach((d) => {
      const idx = this.suppliers.findIndex((s) => s.id === d.id);
      if (idx >= 0) {
        this.suppliers.splice(idx, 1);
        deletedIds.push(d.id);
      }
    });

    ontologyBus.emit({
      type: "action.executed",
      level: "info",
      message: `执行动作: 合并供应商 — 保留 ${target.name} (${targetId}), 删除 ${deletedIds.length} 条重复, 迁移 ${updated} 条关联引用`,
      payload: { target: targetId, deletedIds, updatedRefs: updated },
    });

    deletedIds.forEach((id) => {
      ontologyBus.emit({
        type: "object.deleted",
        level: "info",
        message: `删除对象: 重复供应商 ${id} (合并至 ${targetId})`,
        payload: { objectKind: "Supplier", id },
      });
    });

    ontologyBus.emit({
      type: "object.updated",
      level: "success",
      message: `更新对象: ${target.name} (合并了 ${deletedIds.length} 条重复, 关联引用 +${updated})`,
      payload: { objectKind: "Supplier", supplier: target },
    });

    return { merged: toDelete.length, updated, deletedIds };
  }

  /* ═══════════════════════════════════════════════════════
     真实模拟器 — Persona 系统
     模拟真实用户/系统自动跑流程, 验证 8 要素 + 事件流
     ═══════════════════════════════════════════════════════ */

  /** 提交 PR 时用 persona 身份 */
  submitPurchaseRequestAsPersona(personaName: string, input: { title: string; supplierId: string; amount: number; category: string }) {
    ontologyBus.emit({
      type: "action.executed",
      level: "info",
      message: `👤 [${personaName}] 正在提交采购申请...`,
      payload: { persona: personaName, action: "submit" },
    });
    return this.submitPurchaseRequest({ ...input, requester: personaName });
  }

  /** 审批 PR 时用 persona 身份 + 自动决策 */
  approveAsPersona(personaName: string, personaRole: string, prId: string, autoApprove: boolean, autoComment: string) {
    ontologyBus.emit({
      type: "action.executed",
      level: "info",
      message: `👤 [${personaName} · ${personaRole}] 正在审批 ${prId}...`,
      payload: { persona: personaName, role: personaRole, prId, autoApprove },
    });
    return this.approvePurchaseRequest(prId, personaName, autoComment);
  }

  /** 系统巡检 persona — 周期触发规则违反 */
  systemInspectionTick() {
    ontologyBus.emit({
      type: "action.executed",
      level: "info",
      message: `🤖 [系统巡检 Bot] 启动定期规则巡检`,
    });
    this.simulateRuleViolation();
  }
}

export const ontologyStore = new OntologyStore();
