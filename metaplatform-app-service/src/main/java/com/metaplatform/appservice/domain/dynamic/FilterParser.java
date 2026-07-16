package com.metaplatform.appservice.domain.dynamic;

import com.metaplatform.appservice.api.error.ApiException;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

/**
 * v1.0.2 B1.4: 查询过滤器解析器 — 纯函数, 无 Spring 依赖, 易单测.
 *
 * <p>支持的语法:
 * <pre>
 *   col=value             // 等于 (默认)
 *   col!=value            // 不等于
 *   col>value             // 大于
 *   col>=value            // 大于等于
 *   col<value             // 小于
 *   col<=value            // 小于等于
 *   col~value             // LIKE 包含 (%value%)
 *   col:                  // IS NULL
 *   col in(a,b,c)         // IN 多值
 * </pre>
 *
 * <p>列名必须符合 IDENT_PATTERN (小写字母开头, 数字+下划线, 1-63 字符).
 *
 * <p>所有值通过 PreparedStatement ? 占位符注入, 防 SQL 注入. IN 操作符额外校验值不含单引号.
 */
public final class FilterParser {

    public static final Pattern IDENT_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{0,62}$");

    private FilterParser() {}

    /**
     * 解析单个过滤器. 返回 FilterClause (sql + args); 表达式为空返回 null.
     */
    public static FilterClause parse(String column, String expression) {
        if (!IDENT_PATTERN.matcher(column).matches()) {
            throw ApiException.badRequest("非法过滤列: " + column);
        }
        if (expression == null || expression.isBlank()) {
            return null;
        }

        // v1.0.2 B1.4: 2 字符操作符优先匹配
        if (expression.startsWith("!=")) {
            return new FilterClause(column + " != ?", List.of(expression.substring(2)));
        }
        if (expression.startsWith(">=")) {
            return new FilterClause(column + " >= ?", List.of(expression.substring(2)));
        }
        if (expression.startsWith("<=")) {
            return new FilterClause(column + " <= ?", List.of(expression.substring(2)));
        }
        // in(a,b,c) 或 in (a,b,c)
        if (expression.startsWith("in(") && expression.endsWith(")")) {
            String inside = expression.substring(3, expression.length() - 1);
            if (inside.isBlank()) {
                throw ApiException.badRequest("in() 表达式不能为空");
            }
            String[] parts = inside.split(",");
            for (String p : parts) {
                if (p.contains("'")) {
                    throw ApiException.badRequest("in 表达式值不能包含单引号");
                }
            }
            String placeholders = String.join(",", Collections.nCopies(parts.length, "?"));
            return new FilterClause(column + " IN (" + placeholders + ")",
                    Arrays.asList(parts));
        }

        // 单字符操作符
        String op = expression.substring(0, 1);
        String value = expression.substring(1);

        return switch (op) {
            case ">" -> new FilterClause(
                    value.startsWith("=")
                        ? column + " >= ?"
                        : column + " > ?",
                    value.startsWith("=")
                        ? List.of(value.substring(1))
                        : List.of(value));
            case "<" -> new FilterClause(
                    value.startsWith("=")
                        ? column + " <= ?"
                        : column + " < ?",
                    value.startsWith("=")
                        ? List.of(value.substring(1))
                        : List.of(value));
            case "=" -> new FilterClause(column + " = ?", List.of(value));
            case "~" -> new FilterClause(column + " LIKE ?", List.of("%" + value + "%"));
            case ":" -> new FilterClause(column + " IS NULL", List.of());
            default -> new FilterClause(column + " = ?", List.of(expression));
        };
    }

    /**
     * 解析排序: 前缀 - 表示 DESC, 默认 ASC.
     */
    public static String parseSort(String sortExpr) {
        if (sortExpr == null || sortExpr.isBlank()) return null;
        boolean desc = sortExpr.startsWith("-");
        String column = desc ? sortExpr.substring(1) : sortExpr;
        if (!IDENT_PATTERN.matcher(column).matches()) {
            throw ApiException.badRequest("非法排序列: " + column);
        }
        return column + (desc ? " DESC" : " ASC");
    }

    /** 过滤器解析结果 (sql 片段 + 参数列表). */
    public record FilterClause(String sql, List<Object> args) {}
}