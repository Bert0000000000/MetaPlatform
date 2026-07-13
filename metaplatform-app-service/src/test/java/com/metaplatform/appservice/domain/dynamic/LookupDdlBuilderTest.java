package com.metaplatform.appservice.domain.dynamic;

import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.object.AppObjectService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * B1.3 lookup 字段 DDL 拼接单元测试.
 *
 * <p>覆盖:
 *  - buildLookupColumnDef (列 DDL 片段)
 *  - buildLookupIndexDdl (单条索引)
 *  - buildLookupIndexDdls (批量索引)
 *  - buildDropLookupIndexDdl (回滚 DDL)
 *  - 非法表名/列名校验
 *  - 索引名长度上限 (Postgres 63 字符)
 */
class LookupDdlBuilderTest {

    private AppObjectService.FieldDef lookupField(String code) {
        return new AppObjectService.FieldDef(
                code, "Display", "lookup", false, false,
                new AppObjectService.LookupSpec(1L, "name"));
    }

    // ──────────────────────────────────────────────────────────
    // isLookupField 判定
    // ──────────────────────────────────────────────────────────

    @Test
    void isLookupField_true() {
        var f = lookupField("customer_id");
        assertTrue(LookupDdlBuilder.isLookupField(f));
    }

    @Test
    void isLookupField_false_notLookup() {
        var f = new AppObjectService.FieldDef("name", "Name", "string", false, false, null);
        assertFalse(LookupDdlBuilder.isLookupField(f));
    }

    @Test
    void isLookupField_false_lookupTypeButNullConfig() {
        // type=lookup 但 lookup=null (异常情况, 应视为非 lookup)
        var f = new AppObjectService.FieldDef("x", "X", "lookup", false, false, null);
        assertFalse(LookupDdlBuilder.isLookupField(f));
    }

    @Test
    void isLookupField_nullField() {
        assertFalse(LookupDdlBuilder.isLookupField(null));
    }

    // ──────────────────────────────────────────────────────────
    // buildLookupColumnDef
    // ──────────────────────────────────────────────────────────

    @Test
    void buildLookupColumnDef_basic() {
        var f = lookupField("customer_id");
        String ddl = LookupDdlBuilder.buildLookupColumnDef(f);
        assertEquals("customer_id BIGINT", ddl);
    }

    @Test
    void buildLookupColumnDef_required_addsNotNull() {
        var f = new AppObjectService.FieldDef(
                "fk", "FK", "lookup", true, false,
                new AppObjectService.LookupSpec(1L, "name"));
        String ddl = LookupDdlBuilder.buildLookupColumnDef(f);
        assertEquals("fk BIGINT NOT NULL", ddl);
    }

    @Test
    void buildLookupColumnDef_invalidColumnName_throws() {
        var f = lookupField("Customer-Id");  // 大写+连字符
        var ex = assertThrows(ApiException.class,
                () -> LookupDdlBuilder.buildLookupColumnDef(f));
        assertTrue(ex.getMessage().contains("Customer-Id"));
    }

    @Test
    void buildLookupColumnDef_columnTooLong_throws() {
        // IDENT_PATTERN 是 {0,62}, 允许最多 63 字符 (1 + 62)
        // 64+ 字符才报错
        var f = lookupField("a".repeat(64));
        var ex = assertThrows(ApiException.class,
                () -> LookupDdlBuilder.buildLookupColumnDef(f));
        assertTrue(ex.getMessage().contains("列名"));
    }

    // ──────────────────────────────────────────────────────────
    // buildLookupIndexDdl 单条
    // ──────────────────────────────────────────────────────────

    @Test
    void buildLookupIndexDdl_format() {
        String ddl = LookupDdlBuilder.buildLookupIndexDdl("data_order_a1b2", "customer_id");
        assertEquals(
                "CREATE INDEX idx_data_order_a1b2_customer_id_lookup ON data_order_a1b2(customer_id)",
                ddl);
    }

    @Test
    void buildLookupIndexDdl_invalidTable_throws() {
        var ex = assertThrows(ApiException.class,
                () -> LookupDdlBuilder.buildLookupIndexDdl("malicious_table", "col"));
        assertTrue(ex.getMessage().contains("malicious_table"));
    }

    @Test
    void buildLookupIndexDdl_invalidColumn_throws() {
        assertThrows(ApiException.class,
                () -> LookupDdlBuilder.buildLookupIndexDdl("data_order_x", "Bad-Col"));
    }

    @Test
    void buildLookupIndexDdl_indexNameTooLong_throws() {
        // idx_<table>_<col>_lookup > 63 字符
        String longTable = "data_" + "x".repeat(50);  // 55 字符
        String longCol = "y".repeat(20);
        // total = 4 (idx_) + 55 + 1 (_) + 20 + 7 (_lookup) = 87 > 63
        assertThrows(ApiException.class,
                () -> LookupDdlBuilder.buildLookupIndexDdl(longTable, longCol));
    }

    @Test
    void buildLookupIndexDdl_indexNameAtBoundary_ok() {
        // 边界: 索引名恰好 63 字符 (Postgres 限制)
        // 索引名 = idx_(4) + table + _(1) + col + _lookup(7) = 63
        // table + col = 63 - 12 = 51
        // 我们让 table=50 (data_ + 45 a), col=1 (b) → 4+50+1+1+7 = 63
        String table = "data_" + "a".repeat(45);  // 5 + 45 = 50 chars
        String col = "b".repeat(1);                // 1 char
        String ddl = LookupDdlBuilder.buildLookupIndexDdl(table, col);
        assertTrue(ddl.contains("idx_data_aaa"));
        // 索引名长度恰好 63
        String indexName = ddl.substring(ddl.indexOf("idx_"), ddl.indexOf(" ON"));
        assertEquals(63, indexName.length(), "索引名应恰好 63 字符 (boundary)");
    }

    // ──────────────────────────────────────────────────────────
    // buildLookupIndexDdls 批量
    // ──────────────────────────────────────────────────────────

    @Test
    void buildLookupIndexDdls_emptyFields() {
        List<String> ddls = LookupDdlBuilder.buildLookupIndexDdls("data_o_x", List.of());
        assertTrue(ddls.isEmpty());
    }

    @Test
    void buildLookupIndexDdls_nullFields() {
        List<String> ddls = LookupDdlBuilder.buildLookupIndexDdls("data_o_x", null);
        assertTrue(ddls.isEmpty());
    }

    @Test
    void buildLookupIndexDdls_mixedTypes() {
        var f1 = lookupField("customer_id");
        var f2 = new AppObjectService.FieldDef("name", "Name", "string", false, false, null);
        var f3 = lookupField("product_id");
        List<String> ddls = LookupDdlBuilder.buildLookupIndexDdls("data_order_x", List.of(f1, f2, f3));
        assertEquals(2, ddls.size());
        assertTrue(ddls.get(0).contains("customer_id"));
        assertTrue(ddls.get(1).contains("product_id"));
        assertFalse(ddls.stream().anyMatch(d -> d.contains("name(")));
    }

    @Test
    void buildLookupIndexDdls_allLookupFields() {
        var f1 = lookupField("a_id");
        var f2 = lookupField("b_id");
        var f3 = lookupField("c_id");
        List<String> ddls = LookupDdlBuilder.buildLookupIndexDdls("data_t_x", List.of(f1, f2, f3));
        assertEquals(3, ddls.size());
    }

    @Test
    void buildLookupIndexDdls_noLookupFields() {
        var f1 = new AppObjectService.FieldDef("a", "A", "string", false, false, null);
        var f2 = new AppObjectService.FieldDef("b", "B", "number", false, false, null);
        List<String> ddls = LookupDdlBuilder.buildLookupIndexDdls("data_t_x", List.of(f1, f2));
        assertTrue(ddls.isEmpty());
    }

    // ──────────────────────────────────────────────────────────
    // buildDropLookupIndexDdl
    // ──────────────────────────────────────────────────────────

    @Test
    void buildDropLookupIndexDdl_format() {
        String ddl = LookupDdlBuilder.buildDropLookupIndexDdl("data_order_x", "customer_id");
        assertEquals("DROP INDEX IF EXISTS idx_data_order_x_customer_id_lookup", ddl);
    }

    @Test
    void buildDropLookupIndexDdl_invalidTable_throws() {
        assertThrows(ApiException.class,
                () -> LookupDdlBuilder.buildDropLookupIndexDdl("hacker", "col"));
    }

    // ──────────────────────────────────────────────────────────
    // 常量与边界
    // ──────────────────────────────────────────────────────────

    @Test
    void constants() {
        assertEquals("BIGINT", LookupDdlBuilder.LOOKUP_COLUMN_TYPE);
        assertFalse(LookupDdlBuilder.LOOKUP_NOT_NULL_DEFAULT);
    }
}