package com.metaplatform.wfe.form.engine;

import com.metaplatform.wfe.form.dto.FormLinkageRule;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 数据联动规则引擎（V13-13）：根据字段值匹配条件并计算目标字段状态。
 */
@Component
public class LinkageRuleEngine {

    public LinkageResult evaluate(List<FormLinkageRule> rules, Map<String, Object> values) {
        LinkageResult result = new LinkageResult();
        if (rules == null || rules.isEmpty()) {
            return result;
        }

        Map<String, List<FormLinkageRule>> rulesByTarget = new LinkedHashMap<>();
        for (FormLinkageRule rule : rules) {
            if (rule.getThen() == null) continue;
            rulesByTarget.computeIfAbsent(rule.getThen().getFieldKey(), k -> new ArrayList<>()).add(rule);
        }

        for (List<FormLinkageRule> ruleList : rulesByTarget.values()) {
            for (FormLinkageRule rule : ruleList) {
                if (matches(rule.getWhen(), values)) {
                    apply(rule.getThen(), result);
                    break;
                }
            }
        }
        return result;
    }

    private boolean matches(FormLinkageRule.WhenCondition when, Map<String, Object> values) {
        if (when == null) return true;
        Object actual = values != null ? values.get(when.getFieldKey()) : null;
        Object expected = when.getValue();
        String op = when.getOperator() != null ? when.getOperator() : "eq";

        return switch (op) {
            case "eq" -> Objects.equals(actual, expected);
            case "ne" -> !Objects.equals(actual, expected);
            case "contains" -> actual != null && String.valueOf(actual).contains(String.valueOf(expected));
            case "gt" -> compare(actual, expected) > 0;
            case "lt" -> compare(actual, expected) < 0;
            case "gte" -> compare(actual, expected) >= 0;
            case "lte" -> compare(actual, expected) <= 0;
            case "in" -> expected instanceof Collection<?> c && c.contains(actual);
            default -> Objects.equals(actual, expected);
        };
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private int compare(Object a, Object b) {
        if (a instanceof Comparable ca && b instanceof Comparable cb) {
            try {
                return ca.compareTo(cb);
            } catch (ClassCastException ignored) {
                return String.valueOf(a).compareTo(String.valueOf(b));
            }
        }
        return String.valueOf(a).compareTo(String.valueOf(b));
    }

    private void apply(FormLinkageRule.ThenAction then, LinkageResult result) {
        String key = then.getFieldKey();
        String action = then.getAction();
        if (action == null) return;

        switch (action) {
            case "show" -> result.visible.put(key, true);
            case "hide" -> result.visible.put(key, false);
            case "require" -> result.required.put(key, true);
            case "optional" -> result.required.put(key, false);
            case "readonly" -> result.readonly.put(key, true);
            case "editable" -> result.readonly.put(key, false);
            case "setValue" -> result.value.put(key, then.getValue());
            case "setOptions" -> result.options.put(key, then.getOptions());
        }
    }

    public static class LinkageResult {

        public final Map<String, Boolean> visible = new HashMap<>();
        public final Map<String, Boolean> required = new HashMap<>();
        public final Map<String, Boolean> readonly = new HashMap<>();
        public final Map<String, Object> value = new HashMap<>();
        public final Map<String, List<Map<String, Object>>> options = new HashMap<>();
    }
}
