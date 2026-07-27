package com.metaplatform.wfe.engine.variable;

import com.metaplatform.wfe.engine.model.FlowValue;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 变量引擎：解析 FlowValue（constant/template/ref）、模板插值、审批人表达式解析。
 */
@Component
public class VariableEngine {

    private static final Pattern TEMPLATE_PATTERN = Pattern.compile("\\{\\{(\\w+)}}");
    private static final Pattern ASSIGNEE_PATTERN = Pattern.compile("\\$\\{(\\w+)}");

    /**
     * 解析 FlowValue。
     * - constant → 直接返回 content
     * - template → 调用 interpolate 替换 {{var}}
     * - ref → content 是 [nodeId, varName]，从 context 中查找 "nodeId.varName" 键
     */
    public Object resolve(FlowValue value, Map<String, Object> context) {
        if (value == null) {
            return null;
        }
        if (value.isConstant()) {
            return value.content();
        }
        if (value.isTemplate()) {
            String template = String.valueOf(value.content());
            return interpolate(template, context);
        }
        if (value.isRef()) {
            Object content = value.content();
            if (content instanceof List<?> refList && refList.size() == 2) {
                String nodeId = String.valueOf(refList.get(0));
                String varName = String.valueOf(refList.get(1));
                String key = nodeId + "." + varName;
                return context != null ? context.get(key) : null;
            }
            return null;
        }
        return null;
    }

    /**
     * 模板插值（{{varName}} 语法）。
     */
    public String interpolate(String template, Map<String, Object> context) {
        if (template == null || context == null) {
            return template;
        }
        Matcher matcher = TEMPLATE_PATTERN.matcher(template);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String varName = matcher.group(1);
            Object val = context.get(varName);
            String replacement = val != null ? String.valueOf(val) : "";
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    /**
     * 解析 assignee 表达式（${varName} 语法，简化版）。
     * 例如 "${techLeadId}" → 从 variables 中取 techLeadId 的值。
     * 如果表达式不含 ${} 占位符，则原样返回。
     */
    public String resolveAssignee(String expression, Map<String, Object> variables) {
        if (expression == null) {
            return null;
        }
        Matcher matcher = ASSIGNEE_PATTERN.matcher(expression);
        if (matcher.matches()) {
            String varName = matcher.group(1);
            Object val = variables != null ? variables.get(varName) : null;
            return val != null ? String.valueOf(val) : null;
        }
        return expression;
    }

    /**
     * 求值条件表达式（简化版）。
     * 支持布尔值直接判断和 "true"/"false" 字符串比较。
     */
    public boolean evaluateCondition(Object conditionValue, Map<String, Object> context) {
        if (conditionValue == null) {
            return false;
        }
        if (conditionValue instanceof Boolean b) {
            return b;
        }
        String strVal = String.valueOf(conditionValue);
        return "true".equalsIgnoreCase(strVal);
    }
}
