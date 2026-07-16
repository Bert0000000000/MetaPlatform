package com.metaplatform.appservice.domain.dynamic;

import com.metaplatform.appservice.api.error.ApiException;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * B1.4 FilterParser 单元测试.
 *
 * <p>覆盖 8 种操作符: = != > >= < <= ~ : in
 * + sort + 列名校验 + SQL 注入防护.
 */
class FilterParserTest {

    // ──────────────────────────────────────────────────────────
    // = (等于 / 默认)
    // ──────────────────────────────────────────────────────────

    @Test
    void equals_explicit() {
        var c = FilterParser.parse("status", "=active");
        assertEquals("status = ?", c.sql());
        assertEquals(1, c.args().size());
        assertEquals("active", c.args().get(0));
    }

    @Test
    void equals_implicit_default() {
        var c = FilterParser.parse("status", "active");
        assertEquals("status = ?", c.sql());
        assertEquals("active", c.args().get(0));
    }

    // ──────────────────────────────────────────────────────────
    // != (不等于)
    // ──────────────────────────────────────────────────────────

    @Test
    void notEquals() {
        var c = FilterParser.parse("status", "!=deleted");
        assertEquals("status != ?", c.sql());
        assertEquals("deleted", c.args().get(0));
    }

    @Test
    void notEquals_emptyValue() {
        // 合法: != 后可跟空字符串
        var c = FilterParser.parse("status", "!=");
        assertEquals("status != ?", c.sql());
        assertEquals("", c.args().get(0));
    }

    // ──────────────────────────────────────────────────────────
    // > >= < <=
    // ──────────────────────────────────────────────────────────

    @Test
    void greaterThan() {
        var c = FilterParser.parse("amount", ">100");
        assertEquals("amount > ?", c.sql());
        assertEquals("100", c.args().get(0));
    }

    @Test
    void greaterEqual_2char() {
        var c = FilterParser.parse("amount", ">=100");
        assertEquals("amount >= ?", c.sql());
        assertEquals("100", c.args().get(0));
    }

    @Test
    void lessThan() {
        var c = FilterParser.parse("amount", "<1000");
        assertEquals("amount < ?", c.sql());
        assertEquals("1000", c.args().get(0));
    }

    @Test
    void lessEqual_2char() {
        var c = FilterParser.parse("amount", "<=1000");
        assertEquals("amount <= ?", c.sql());
        assertEquals("1000", c.args().get(0));
    }

    @Test
    void greaterEqual_1char_plusEqual() {
        // >= 也能写为 >=
        var c = FilterParser.parse("amount", ">=100");
        assertEquals("amount >= ?", c.sql());
    }

    // ──────────────────────────────────────────────────────────
    // ~ (LIKE 包含)
    // ──────────────────────────────────────────────────────────

    @Test
    void like_contains() {
        var c = FilterParser.parse("name", "~张");
        assertEquals("name LIKE ?", c.sql());
        assertEquals("%张%", c.args().get(0));
    }

    @Test
    void like_emptyValue() {
        // % % 全匹配
        var c = FilterParser.parse("name", "~");
        assertEquals("name LIKE ?", c.sql());
        assertEquals("%%", c.args().get(0));
    }

    // ──────────────────────────────────────────────────────────
    // : (IS NULL)
    // ──────────────────────────────────────────────────────────

    @Test
    void isNull() {
        var c = FilterParser.parse("remark", ":");
        assertEquals("remark IS NULL", c.sql());
        assertTrue(c.args().isEmpty());
    }

    // ──────────────────────────────────────────────────────────
    // in (多值)
    // ──────────────────────────────────────────────────────────

    @Test
    void in_threeValues() {
        var c = FilterParser.parse("status", "in(active,pending,review)");
        assertEquals("status IN (?,?,?)", c.sql());
        assertEquals(3, c.args().size());
        assertEquals("active", c.args().get(0));
        assertEquals("pending", c.args().get(1));
        assertEquals("review", c.args().get(2));
    }

    @Test
    void in_singleValue() {
        var c = FilterParser.parse("status", "in(active)");
        assertEquals("status IN (?)", c.sql());
        assertEquals(1, c.args().size());
    }

    @Test
    void in_empty_throws() {
        assertThrows(ApiException.class, () -> FilterParser.parse("status", "in()"));
    }

    @Test
    void in_withSqlInjection_rejected() {
        var ex = assertThrows(ApiException.class,
                () -> FilterParser.parse("status", "in(active,' OR 1=1)"));
        assertTrue(ex.getMessage().contains("单引号"));
    }

    @Test
    void in_notClosed_throws() {
        // in(active → 默认 = 精确匹配
        var c = FilterParser.parse("status", "in(active");
        assertEquals("status = ?", c.sql());
    }

    // ──────────────────────────────────────────────────────────
    // 校验: 列名
    // ──────────────────────────────────────────────────────────

    @Test
    void invalidColumn_throws() {
        assertThrows(ApiException.class, () -> FilterParser.parse("Bad-Name", "=x"));
    }

    @Test
    void invalidColumn_uppercase_throws() {
        assertThrows(ApiException.class, () -> FilterParser.parse("Amount", ">100"));
    }

    @Test
    void invalidColumn_tooLong_throws() {
        // 64 字符 > IDENT_PATTERN 允许的 63 字符
        String longCol = "a".repeat(64);
        assertThrows(ApiException.class, () -> FilterParser.parse(longCol, "=x"));
    }

    @Test
    void invalidColumn_chinese_throws() {
        assertThrows(ApiException.class, () -> FilterParser.parse("金额", ">100"));
    }

    // ──────────────────────────────────────────────────────────
    // 空表达式
    // ──────────────────────────────────────────────────────────

    @Test
    void emptyExpression_returnsNull() {
        assertNull(FilterParser.parse("name", ""));
    }

    @Test
    void blankExpression_returnsNull() {
        assertNull(FilterParser.parse("name", "   "));
    }

    @Test
    void nullExpression_returnsNull() {
        assertNull(FilterParser.parse("name", null));
    }

    // ──────────────────────────────────────────────────────────
    // parseSort
    // ──────────────────────────────────────────────────────────

    @Test
    void sort_ascending() {
        assertEquals("amount ASC", FilterParser.parseSort("amount"));
    }

    @Test
    void sort_descending() {
        assertEquals("amount DESC", FilterParser.parseSort("-amount"));
    }

    @Test
    void sort_nullOrBlank() {
        assertNull(FilterParser.parseSort(null));
        assertNull(FilterParser.parseSort(""));
        assertNull(FilterParser.parseSort("   "));
    }

    @Test
    void sort_invalidColumn_throws() {
        assertThrows(ApiException.class, () -> FilterParser.parseSort("Amount"));
        assertThrows(ApiException.class, () -> FilterParser.parseSort("-Amount"));
    }

    @Test
    void sort_invalidColumn_injection_throws() {
        assertThrows(ApiException.class, () -> FilterParser.parseSort("name; DROP TABLE users"));
    }

    // ──────────────────────────────────────────────────────────
    // 集成场景 (combine filter + sort)
    // ──────────────────────────────────────────────────────────

    @Test
    void combined_multipleFilters() {
        // 模拟 controller 一次性处理多个 filter (用 LinkedHashMap 保留顺序)
        Map<String, String> rawFilters = new java.util.LinkedHashMap<>();
        rawFilters.put("status", "=active");
        rawFilters.put("amount", ">=100");
        rawFilters.put("name", "~张");

        StringBuilder where = new StringBuilder();
        for (var entry : rawFilters.entrySet()) {
            var clause = FilterParser.parse(entry.getKey(), entry.getValue());
            where.append(" AND ").append(clause.sql());
        }
        assertEquals(" AND status = ? AND amount >= ? AND name LIKE ?", where.toString());
    }
}