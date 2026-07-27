package com.metaplatform.rule.decisiontable.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.decisiontable.dto.DecisionTableColumnDto;
import com.metaplatform.rule.decisiontable.dto.DecisionTableRowResponse;
import com.metaplatform.rule.decisiontable.entity.DecisionTableEntity;
import com.metaplatform.rule.decisiontable.entity.DecisionTableRowEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 决策表执行引擎（P1-2）。
 *
 * <p>统一封装决策表匹配逻辑，被 {@link com.metaplatform.rule.decisiontable.controller.DecisionTableController#execute}
 * 与 {@link com.metaplatform.rule.testing.service.RuleTestingService#testDecisionTable} 复用。</p>
 *
 * <p>支持的操作符：
 * <ul>
 *   <li>{@code eq} / {@code ne}：等值 / 不等</li>
 *   <li>{@code gt} / {@code lt} / {@code gte} / {@code lte}：数值 / 日期 大小比较</li>
 *   <li>{@code in}：输入值在配置的集合中（配置值为数组或逗号分隔字符串）</li>
 *   <li>{@code contains}：字符串或集合包含</li>
 *   <li>{@code between}：在 [min, max] 区间（配置值 "min,max" 或 [min,max] 数组）</li>
 *   <li>{@code startsWith} / {@code endsWith}：字符串前缀 / 后缀匹配</li>
 * </ul>
 * 列的 operator 默认为 {@code eq}；类型派生自 {@link DecisionTableColumnDto#getDataType()}，
 * 未指定时按字符串匹配，数值字段自动转 BigDecimal 比较。</p>
 *
 * <p>列 operator 声明方式：通过 {@link DecisionTableColumnDto#getExpression()} 字段以
 * {@code "op:gt"} 形式承载（避免破坏现有 JSON schema），未声明则默认 {@code eq}。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DecisionTableExecutionEngine {

    private static final Set<String> SUPPORTED_OPERATORS = Set.of(
            "eq", "ne", "gt", "lt", "gte", "lte",
            "in", "contains", "between", "startsWith", "endsWith");

    private static final String DEFAULT_OPERATOR = "eq";

    private final DecisionTableRowService decisionTableRowService;
    private final ObjectMapper objectMapper;

    /**
     * 执行决策表，返回命中行列表与对应输出。
     *
     * @param table     决策表实体
     * @param inputData 输入数据
     * @return 命中行 + 输出列表（按命中策略 FIRST/ALL/PRIORITY 控制）
     */
    public ExecutionOutcome execute(DecisionTableEntity table, Map<String, Object> inputData) {
        return execute(table, inputData, null);
    }

    /**
     * 执行决策表（可指定只取行输出，用于 testing 场景）。
     *
     * @param table          决策表实体
     * @param inputData      输入数据
     * @param onlyOutputs    true：只返回 outputs，matchedRows 为空（用于测试场景减少序列化开销）
     * @return 执行结果
     */
    public ExecutionOutcome execute(DecisionTableEntity table, Map<String, Object> inputData, Boolean onlyOutputs) {
        String hitPolicy = table.getHitPolicy() == null ? "FIRST" : table.getHitPolicy().toUpperCase();
        Map<String, DecisionTableColumnDto> columnMap = buildColumnMap(table);
        List<DecisionTableRowEntity> rows = decisionTableRowService.getEnabledRows(table.getId());

        List<DecisionTableRowResponse> matchedRows = new ArrayList<>();
        List<Map<String, Object>> outputs = new ArrayList<>();

        for (DecisionTableRowEntity row : rows) {
            Map<String, Object> rowInputs = row.getInputValues();
            if (matchesInput(inputData, rowInputs, columnMap)) {
                if (!Boolean.TRUE.equals(onlyOutputs)) {
                    matchedRows.add(decisionTableRowService.toRowResponse(row));
                }
                outputs.add(decisionTableRowService.readOutputMap(row));
                if ("FIRST".equalsIgnoreCase(hitPolicy)) {
                    break;
                }
            }
        }
        return new ExecutionOutcome(matchedRows, outputs);
    }

    /**
     * 决策表匹配核心：逐列按 operator 比较 inputData 与 rowInputs。
     *
     * <p>空 rowInputs 视为通配（命中）。未在 columnMap 中显式定义的列按字符串 eq 兜底。</p>
     */
    boolean matchesInput(Map<String, Object> inputData, Map<String, Object> rowInputs,
                          Map<String, DecisionTableColumnDto> columnMap) {
        if (rowInputs == null || rowInputs.isEmpty()) {
            return true;
        }
        for (Map.Entry<String, Object> entry : rowInputs.entrySet()) {
            String field = entry.getKey();
            Object expected = entry.getValue();
            Object actual = inputData == null ? null : inputData.get(field);
            DecisionTableColumnDto column = columnMap.get(field);
            String operator = resolveOperator(column);
            String dataType = column != null ? column.getDataType() : null;
            if (!applyOperator(operator, dataType, expected, actual)) {
                return false;
            }
        }
        return true;
    }

    private String resolveOperator(DecisionTableColumnDto column) {
        if (column == null) {
            return DEFAULT_OPERATOR;
        }
        // 复用 expression 字段承载 operator（V1.2 列定义未单独提供 operator 字段时，
        // 允许通过 expression="op:gt" 这种轻量方式声明；缺省 eq）
        String expr = column.getExpression();
        if (expr != null && !expr.isBlank() && expr.toLowerCase().startsWith("op:")) {
            String op = expr.substring(3).trim().toLowerCase();
            if (SUPPORTED_OPERATORS.contains(op)) {
                return op;
            }
        }
        return DEFAULT_OPERATOR;
    }

    private Map<String, DecisionTableColumnDto> buildColumnMap(DecisionTableEntity table) {
        Map<String, DecisionTableColumnDto> map = new HashMap<>();
        for (DecisionTableColumnDto col : readColumns(table.getInputColumns())) {
            if (col.getField() != null) {
                map.put(col.getField(), col);
            }
        }
        return map;
    }

    private List<DecisionTableColumnDto> readColumns(Map<String, Object> input) {
        if (input == null) return List.of();
        try {
            String json = objectMapper.writeValueAsString(input);
            if (json == null || json.isBlank()) return List.of();
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private boolean applyOperator(String operator, String dataType, Object expected, Object actual) {
        try {
            return switch (operator) {
                case "eq" -> equalsWithType(expected, actual, dataType);
                case "ne" -> !equalsWithType(expected, actual, dataType);
                case "gt" -> compareNumbersOrDates(expected, actual, dataType) > 0;
                case "lt" -> compareNumbersOrDates(expected, actual, dataType) < 0;
                case "gte" -> compareNumbersOrDates(expected, actual, dataType) >= 0;
                case "lte" -> compareNumbersOrDates(expected, actual, dataType) <= 0;
                case "in" -> matchesIn(expected, actual);
                case "contains" -> matchesContains(expected, actual);
                case "between" -> matchesBetween(expected, actual, dataType);
                case "startsWith" -> matchesStartsWith(expected, actual);
                case "endsWith" -> matchesEndsWith(expected, actual);
                default -> equalsWithType(expected, actual, dataType);
            };
        } catch (Exception e) {
            log.warn("Decision table operator {} failed: expected={}, actual={}, error={}",
                    operator, expected, actual, e.getMessage());
            return false;
        }
    }

    private boolean equalsWithType(Object expected, Object actual, String dataType) {
        if (expected == null && actual == null) return true;
        if (expected == null || actual == null) return false;
        if ("NUMBER".equalsIgnoreCase(dataType) || isNumeric(expected) || isNumeric(actual)) {
            BigDecimal expNum = toBigDecimal(expected);
            BigDecimal actNum = toBigDecimal(actual);
            return expNum != null && expNum.compareTo(actNum) == 0;
        }
        if ("BOOLEAN".equalsIgnoreCase(dataType)) {
            return toBoolean(expected) == toBoolean(actual);
        }
        return Objects.equals(String.valueOf(expected), String.valueOf(actual));
    }

    private int compareNumbersOrDates(Object expected, Object actual, String dataType) {
        if ("DATE".equalsIgnoreCase(dataType) || isDateLike(expected) || isDateLike(actual)) {
            LocalDate expDate = toDate(expected);
            LocalDate actDate = toDate(actual);
            if (expDate == null || actDate == null) {
                return String.valueOf(expected).compareTo(String.valueOf(actual));
            }
            return expDate.compareTo(actDate);
        }
        BigDecimal expNum = toBigDecimal(expected);
        BigDecimal actNum = toBigDecimal(actual);
        if (expNum == null || actNum == null) {
            return String.valueOf(expected).compareTo(String.valueOf(actual));
        }
        return expNum.compareTo(actNum);
    }

    @SuppressWarnings("unchecked")
    private boolean matchesIn(Object expected, Object actual) {
        if (expected == null) return actual == null;
        Collection<Object> candidates;
        if (expected instanceof Collection<?> col) {
            candidates = (Collection<Object>) col;
        } else {
            String str = String.valueOf(expected);
            String[] parts = str.split(",");
            candidates = new ArrayList<>();
            for (String p : parts) {
                candidates.add(p.trim());
            }
        }
        String actualStr = actual == null ? null : String.valueOf(actual);
        for (Object c : candidates) {
            if (c == null) {
                if (actual == null) return true;
            } else if (String.valueOf(c).equals(actualStr)) {
                return true;
            } else if (isNumeric(c) && isNumeric(actual)
                    && toBigDecimal(c).compareTo(toBigDecimal(actual)) == 0) {
                return true;
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private boolean matchesContains(Object expected, Object actual) {
        if (expected == null || actual == null) return false;
        if (actual instanceof Collection<?> col) {
            for (Object item : col) {
                if (Objects.equals(String.valueOf(item), String.valueOf(expected))) {
                    return true;
                }
            }
            return false;
        }
        return String.valueOf(actual).contains(String.valueOf(expected));
    }

    private boolean matchesBetween(Object expected, Object actual, String dataType) {
        if (expected == null) return false;
        BigDecimal[] range = parseRange(expected);
        if (range == null || range.length != 2) {
            return false;
        }
        BigDecimal actNum = "DATE".equalsIgnoreCase(dataType) ? null : toBigDecimal(actual);
        if (actNum != null) {
            return actNum.compareTo(range[0]) >= 0 && actNum.compareTo(range[1]) <= 0;
        }
        if (isDateLike(actual)) {
            LocalDate actDate = toDate(actual);
            LocalDate startDate = toDate(range[0].toPlainString());
            LocalDate endDate = toDate(range[1].toPlainString());
            if (actDate != null && startDate != null && endDate != null) {
                return !actDate.isBefore(startDate) && !actDate.isAfter(endDate);
            }
        }
        String actualStr = actual == null ? "" : String.valueOf(actual);
        return actualStr.compareTo(range[0].toPlainString()) >= 0
                && actualStr.compareTo(range[1].toPlainString()) <= 0;
    }

    private boolean matchesStartsWith(Object expected, Object actual) {
        if (expected == null || actual == null) return false;
        return String.valueOf(actual).startsWith(String.valueOf(expected));
    }

    private boolean matchesEndsWith(Object expected, Object actual) {
        if (expected == null || actual == null) return false;
        return String.valueOf(actual).endsWith(String.valueOf(expected));
    }

    private BigDecimal[] parseRange(Object expected) {
        if (expected instanceof Collection<?> col && col.size() == 2) {
            Object[] arr = col.toArray();
            BigDecimal a = toBigDecimal(arr[0]);
            BigDecimal b = toBigDecimal(arr[1]);
            if (a != null && b != null) return new BigDecimal[]{a, b};
        }
        String str = String.valueOf(expected);
        if (str.contains(",")) {
            String[] parts = str.split(",", 2);
            BigDecimal a = toBigDecimal(parts[0].trim());
            BigDecimal b = toBigDecimal(parts[1].trim());
            if (a != null && b != null) return new BigDecimal[]{a, b};
        }
        return null;
    }

    private boolean isNumeric(Object value) {
        if (value == null) return false;
        if (value instanceof Number) return true;
        String s = String.valueOf(value).trim();
        if (s.isEmpty()) return false;
        try {
            new BigDecimal(s);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal bd) return bd;
        if (value instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try {
            return new BigDecimal(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean isDateLike(Object value) {
        if (value == null) return false;
        String s = String.valueOf(value).trim();
        if (s.isEmpty()) return false;
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try {
                if (fmt == DATE_FORMATTER) {
                    LocalDate.parse(s, fmt);
                } else {
                    LocalDateTime.parse(s, fmt);
                }
                return true;
            } catch (DateTimeParseException ignored) {
                // try next
            }
        }
        return false;
    }

    private LocalDate toDate(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDate ld) return ld;
        if (value instanceof LocalDateTime ldt) return ldt.toLocalDate();
        String s = String.valueOf(value).trim();
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try {
                if (fmt == DATE_FORMATTER) {
                    return LocalDate.parse(s, fmt);
                }
                return LocalDateTime.parse(s, fmt).toLocalDate();
            } catch (DateTimeParseException ignored) {
                // try next
            }
        }
        return null;
    }

    private boolean toBoolean(Object value) {
        if (value == null) return false;
        if (value instanceof Boolean b) return b;
        String s = String.valueOf(value).trim().toLowerCase();
        return "true".equals(s) || "1".equals(s) || "yes".equals(s) || "y".equals(s);
    }

    private List<DecisionTableColumnDto> readColumns(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter[] DATE_FORMATS = new DateTimeFormatter[]{
            DATE_FORMATTER,
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss"),
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ISO_LOCAL_DATE_TIME
    };

    /**
     * 执行结果：命中行列表 + 对应输出列表。
     */
    public record ExecutionOutcome(List<DecisionTableRowResponse> matchedRows,
                                    List<Map<String, Object>> outputs) {
    }
}
