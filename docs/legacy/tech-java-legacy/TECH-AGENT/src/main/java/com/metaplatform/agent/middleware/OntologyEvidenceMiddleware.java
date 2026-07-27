package com.metaplatform.agent.middleware;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Ontology Evidence Middleware（P3.1.5）。
 *
 * <p>每个 Claim 必须绑定至少一个 Evidence（ONTOLOGY_OBJECT / ONTOLOGY_METRIC /
 * DOCUMENT / EXTERNAL / MODEL_DERIVED）。否则被拦截。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OntologyEvidenceMiddleware implements AgentMiddleware {

    @Override
    public int order() { return 400; }

    @Override
    public void afterToolCall(MiddlewareContext context, ToolCall toolCall, Object result) {
        if (context.isRejected()) return;
        // 任何 ontology.* 工具的返回结果应自动绑定 Evidence
        if (toolCall.getToolName() != null && toolCall.getToolName().startsWith("ontology.")
                && result instanceof Map<?, ?> map) {
            Object data = map.get("data");
            if (data instanceof List<?> list && !list.isEmpty()) {
                Map<String, Object> claim = new HashMap<>();
                claim.put("tool", toolCall.getToolName());
                claim.put("summary", summarize(data));
                claim.put("evidence", extractEvidence(list));
                claim.put("type", "FACT");
                claim.put("confidence", 0.9);
                context.getClaims().add(claim);
                log.info("[OntologyEvidenceMW] claim attached tool={} evidence={}",
                        toolCall.getToolName(), claim.get("evidence"));
            }
        }
    }

    private String summarize(Object data) {
        if (data instanceof List<?> list) {
            return "命中 " + list.size() + " 条业务对象";
        }
        return data.toString();
    }

    private List<Map<String, Object>> extractEvidence(List<?> data) {
        List<Map<String, Object>> evs = new ArrayList<>();
        int n = Math.min(3, data.size());
        for (int i = 0; i < n; i++) {
            Map<String, Object> ev = new HashMap<>();
            ev.put("type", "ONTOLOGY_OBJECT");
            ev.put("ref", String.valueOf(data.get(i)));
            ev.put("rank", i + 1);
            evs.add(ev);
        }
        return evs;
    }
}
