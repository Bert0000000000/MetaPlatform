package com.metaplatform.agent.middleware;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Ontology Grounding Middleware (P3.1.3).
 *
 * <p>Maps user natural language to Concept / Object / Metric / Action candidates.
 * In production this delegates to LLMGW (P3.1 stub: keyword-based fallback).
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
        Map<String, Object> grounded = new HashMap<>();
        String msg = context.getUserMessage() == null ? "" : context.getUserMessage();
        List<String> concepts = detectConcepts(msg);
        List<String> metrics = detectMetrics(msg);
        List<String> candidates = detectActionCandidates(msg);
        // P2.2.4 cross-domain: when sales/revenue decline is detected, also surface customer churn
        if (metrics.contains("sales.revenue") && (msg.contains("下降") || msg.contains("衰出") || msg.contains("走低"))) {
            if (!metrics.contains("customer.churn_rate")) metrics.add("customer.churn_rate");
        }
        if (metrics.contains("sales.revenue") && (msg.contains("原因") || msg.contains("为什么"))) {
            // root cause analysis: also surface customer.count to look at customer base
            if (!metrics.contains("customer.count")) metrics.add("customer.count");
        }
        grounded.put("concepts", concepts);
        grounded.put("metrics", metrics);
        grounded.put("actionCandidates", candidates);
        grounded.put("confidence", concepts.isEmpty() && metrics.isEmpty() ? 0.4 : 0.85);
        context.setGrounding(grounded);
        log.info("[OntologyGroundingMW] msg={{}... concepts={} metrics={}", msg.length() > 32 ? msg.substring(0, 32) : msg, concepts, metrics);

    }

    private List<String> detectConcepts(String msg) {
        Set<String> c = new LinkedHashSet<>();
        if (msg.contains("客户")) c.add("Customer");
        if (msg.contains("订单")) c.add("Order");
        if (msg.contains("合同")) c.add("Contract");
        if (msg.contains("工单") || msg.contains("客服")) c.add("SupportTicket");
        if (msg.contains("产品")) c.add("Product");
        if (msg.contains("指标") || msg.contains("销售") || msg.contains("收入")) c.add("Metric");
        if (msg.contains("区域") || msg.contains("华东") || msg.contains("华北") || msg.contains("华南") || msg.contains("西南")) c.add("Region");
        return new ArrayList<>(c);
    }

    private List<String> detectMetrics(String msg) {
        Set<String> m = new LinkedHashSet<>();
        if (msg.contains("销售")) m.add("sales.revenue");
        if (msg.contains("收入")) m.add("revenue");
        if (msg.contains("客户")) m.add("customer.count");
        if (msg.contains("流失") || msg.contains("衰出") || msg.contains("走低")) m.add("customer.churn_rate");
        if (msg.contains("毛利")) m.add("profit.margin");
        if (msg.contains("下降") || msg.contains("减少")) m.add("metric.decline_rate");
        return new ArrayList<>(m);
    }

    private List<String> detectActionCandidates(String msg) {
        Set<String> a = new LinkedHashSet<>();
        if (msg.contains("创建") || msg.contains("跟进")) a.add("CreateFollowUpTask");
        if (msg.contains("申请") && msg.contains("优惠")) a.add("RequestDiscount");
        if (msg.contains("通知")) a.add("NotifyOwner");
        if (msg.contains("分析") || msg.contains("原因")) a.add("AnalyzeRootCause");
        // Cross-domain root-cause analysis: also surface follow-up task as a candidate
        if (msg.contains("分析") && (msg.contains("下降") || msg.contains("原因") || msg.contains("区域"))) a.add("CreateFollowUpTask");
        return new ArrayList<>(a);
    }
}
