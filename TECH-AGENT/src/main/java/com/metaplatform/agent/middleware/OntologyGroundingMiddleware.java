package com.metaplatform.agent.middleware;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Ontology Grounding Middleware（P3.1.3）。
 *
 * <p>把用户自然语言映射为 Concept / Object / Metric / Action 候选。
 * 在 beforeExecution 时调用一次，结果存入 context.grounding。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OntologyGroundingMiddleware implements AgentMiddleware {

    @Override
    public int order() { return 200; }

    @Override
    public void beforeExecution(MiddlewareContext context) {
        if (context.isRejected()) return;
        // P3.1 占位：实际由 LLMGW 调一次大模型完成 Grounding
        // 这里用关键词匹配作为兜底
        Map<String, Object> grounded = new HashMap<>();
        String msg = context.getUserMessage() == null ? "" : context.getUserMessage();
        List<String> concepts = detectConcepts(msg);
        List<String> metrics = detectMetrics(msg);
        List<String> candidates = detectActionCandidates(msg);
        grounded.put("concepts", concepts);
        grounded.put("metrics", metrics);
        grounded.put("actionCandidates", candidates);
        grounded.put("confidence", concepts.isEmpty() ? 0.4 : 0.85);
        context.setGrounding(grounded);
        log.info("[OntologyGroundingMW] msg='{}...' concepts={} metrics={}",
                msg.length() > 32 ? msg.substring(0, 32) : msg, concepts, metrics);
    }

    private List<String> detectConcepts(String msg) {
        // 简单关键词匹配；生产由 LLM 完成
        Set<String> c = new LinkedHashSet<>();
        if (msg.contains("客户")) c.add("Customer");
        if (msg.contains("订单")) c.add("Order");
        if (msg.contains("合同")) c.add("Contract");
        if (msg.contains("工单") || msg.contains("客服")) c.add("SupportTicket");
        if (msg.contains("产品")) c.add("Product");
        if (msg.contains("指标") || msg.contains("销售") || msg.contains("收入")) c.add("Metric");
        return new ArrayList<>(c);
    }

    private List<String> detectMetrics(String msg) {
        Set<String> m = new LinkedHashSet<>();
        if (msg.contains("销售")) m.add("sales.revenue");
        if (msg.contains("收入")) m.add("revenue");
        if (msg.contains("客户")) m.add("customer.count");
        if (msg.contains("流失")) m.add("customer.churn_rate");
        if (msg.contains("毛利")) m.add("profit.margin");
        return new ArrayList<>(m);
    }

    private List<String> detectActionCandidates(String msg) {
        Set<String> a = new LinkedHashSet<>();
        if (msg.contains("创建") || msg.contains("跟进")) a.add("CreateFollowUpTask");
        if (msg.contains("申请") && msg.contains("优惠")) a.add("RequestDiscount");
        if (msg.contains("通知")) a.add("NotifyOwner");
        return new ArrayList<>(a);
    }
}
