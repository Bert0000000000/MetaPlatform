package com.metaplatform.action.policy;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.util.*;

/**
 * Action Policy Service（Phase 5.1）。
 *
 * <p>加载 {@code action-policies.yaml}，按 Action × Role × Risk 决定决策：
 * <ul>
 *   <li>auto — 直接执行</li>
 *   <li>approval — 进入 Temporal/WFE 审批</li>
 *   <li>reject — 拒绝</li>
 * </ul>
 */
@Slf4j
@Service
public class ActionPolicyService {

    private Map<String, Object> policy = Map.of();

    @PostConstruct
    public void load() {
        try {
            Yaml yaml = new Yaml();
            try (InputStream in = new ClassPathResource("action-policies.yaml").getInputStream()) {
                policy = yaml.load(in);
            }
            log.info("[ActionPolicyService] policy loaded keys={}", policy.keySet());
        } catch (Exception e) {
            log.warn("[ActionPolicyService] load failed: {}", e.getMessage());
        }
    }

    public Decision decide(String actionCode, String riskLevel, List<String> roles) {
        List<String> forbiddenActions = collectRoleRestrictions(roles);
        if (forbiddenActions.contains(actionCode)) {
            return Decision.reject("角色 " + roles + " 无权执行 " + actionCode);
        }

        List<Map<String, Object>> overrides = (List<Map<String, Object>>) policy.getOrDefault("overrides", List.of());
        for (Map<String, Object> o : overrides) {
            if (Objects.equals(o.get("actionCode"), actionCode)
                    && Objects.equals(o.get("riskLevel"), riskLevel)) {
                String dec = String.valueOf(o.getOrDefault("defaultDecision", "approval"));
                return mapDecision(dec, "explicit override");
            }
        }

        Map<String, String> defaultPolicy = (Map<String, String>) policy.getOrDefault("defaultPolicy", Map.of());
        String def = defaultPolicy.getOrDefault(riskLevel == null ? "low" : riskLevel.toLowerCase(), "approval");
        return mapDecision(def, "default policy");
    }

    private List<String> collectRoleRestrictions(List<String> roles) {
        List<String> all = new ArrayList<>();
        List<Map<String, Object>> rr = (List<Map<String, Object>>) policy.getOrDefault("roleRestrictions", List.of());
        for (Map<String, Object> r : rr) {
            if (roles != null && roles.contains(r.get("role"))) {
                @SuppressWarnings("unchecked")
                List<String> forbidden = (List<String>) r.getOrDefault("forbiddenActions", List.of());
                all.addAll(forbidden);
            }
        }
        return all;
    }

    private Decision mapDecision(String dec, String reason) {
        return switch (dec.toLowerCase()) {
            case "auto" -> Decision.auto(reason);
            case "approval" -> Decision.approval(reason);
            case "reject" -> Decision.reject(reason);
            default -> Decision.approval("unknown decision: " + dec);
        };
    }

    public record Decision(String type, String reason) {
        public static Decision auto(String r) { return new Decision("AUTO", r); }
        public static Decision approval(String r) { return new Decision("APPROVAL", r); }
        public static Decision reject(String r) { return new Decision("REJECT", r); }
        public boolean isAuto() { return "AUTO".equals(type); }
        public boolean isApproval() { return "APPROVAL".equals(type); }
        public boolean isReject() { return "REJECT".equals(type); }
    }
}
