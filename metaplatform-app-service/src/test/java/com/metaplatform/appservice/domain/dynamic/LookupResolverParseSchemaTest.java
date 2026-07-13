package com.metaplatform.appservice.domain.dynamic;

import com.metaplatform.appservice.api.error.ApiException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * B1.5 LookupResolver.parseSchemaLookups 单元测试.
 *
 * <p>覆盖:
 *  - 正常 schemaJson 解析 (单/多 lookup 字段)
 *  - 空 / null schema
 *  - 非数组 schema
 *  - lookup 子对象缺失
 *  - lookup.targetObjectId 缺失
 *  - 非 lookup 字段被忽略
 */
class LookupResolverParseSchemaTest {

    private final LookupResolver resolver = new LookupResolver(null, null);

    @Test
    void parse_singleLookupField() {
        String schema = """
                [
                  {"code":"customer_id","name":"Customer","type":"lookup",
                   "lookup":{"objectId":5,"displayField":"name"}}
                ]""";
        List<LookupResolver.LookupFieldDef> result = resolver.parseSchemaLookups(schema);
        assertEquals(1, result.size());
        LookupResolver.LookupFieldDef lf = result.get(0);
        assertEquals("customer_id", lf.column());
        assertEquals("name", lf.displayField());
        assertEquals(5L, lf.targetObjectId());
        assertNull(lf.targetTableName(), "targetTableName 在 resolve 时填充");
    }

    @Test
    void parse_multipleLookupFields() {
        String schema = """
                [
                  {"code":"customer_id","type":"lookup",
                   "lookup":{"objectId":5,"displayField":"name"}},
                  {"code":"product_id","type":"lookup",
                   "lookup":{"objectId":8,"displayField":"sku"}}
                ]""";
        List<LookupResolver.LookupFieldDef> result = resolver.parseSchemaLookups(schema);
        assertEquals(2, result.size());
        assertEquals("customer_id", result.get(0).column());
        assertEquals(5L, result.get(0).targetObjectId());
        assertEquals("product_id", result.get(1).column());
        assertEquals(8L, result.get(1).targetObjectId());
        assertEquals("sku", result.get(1).displayField());
    }

    @Test
    void parse_mixedFields_ignoresNonLookup() {
        String schema = """
                [
                  {"code":"name","type":"string"},
                  {"code":"amount","type":"number"},
                  {"code":"customer_id","type":"lookup",
                   "lookup":{"objectId":5,"displayField":"name"}}
                ]""";
        List<LookupResolver.LookupFieldDef> result = resolver.parseSchemaLookups(schema);
        assertEquals(1, result.size());
        assertEquals("customer_id", result.get(0).column());
    }

    @Test
    void parse_nullSchema_returnsEmpty() {
        assertTrue(resolver.parseSchemaLookups(null).isEmpty());
    }

    @Test
    void parse_blankSchema_returnsEmpty() {
        assertTrue(resolver.parseSchemaLookups("").isEmpty());
        assertTrue(resolver.parseSchemaLookups("   ").isEmpty());
    }

    @Test
    void parse_nonArraySchema_returnsEmpty() {
        // 容错: JSON object 不是 array — 返回空 (schema 应是 array, 但要兜底)
        List<LookupResolver.LookupFieldDef> result = resolver.parseSchemaLookups("{\"foo\":\"bar\"}");
        assertTrue(result.isEmpty());
    }

    @Test
    void parse_missingLookupSubObject_skipped() {
        // type=lookup 但没 lookup 子对象 — 容错跳过 (B1.2 应该已校验写入完整性, 这里只是兜底)
        String schema = """
                [{"code":"customer_id","type":"lookup"}]""";
        List<LookupResolver.LookupFieldDef> result = resolver.parseSchemaLookups(schema);
        assertTrue(result.isEmpty());
    }

    @Test
    void parse_lookupWithoutObjectId_skipped() {
        // lookup 子对象但缺少 objectId — 跳过
        String schema = """
                [{"code":"customer_id","type":"lookup","lookup":{"displayField":"name"}}]""";
        List<LookupResolver.LookupFieldDef> result = resolver.parseSchemaLookups(schema);
        assertTrue(result.isEmpty());
    }

    @Test
    void parse_invalidJson_throws() {
        var ex = assertThrows(ApiException.class,
                () -> resolver.parseSchemaLookups("not json"));
        assertTrue(ex.getMessage().contains("schema_json"));
    }

    @Test
    void parse_missingType_ignored() {
        // 没有 type 字段的非 lookup — 跳过
        String schema = """
                [{"code":"name","lookup":{"objectId":5,"displayField":"name"}}]""";
        assertTrue(resolver.parseSchemaLookups(schema).isEmpty());
    }

    @Test
    void parse_lookupWithAdditionalFields_preserved() {
        // schema 中可能含额外字段 (required, unique, description), 必须容忍
        String schema = """
                [
                  {"code":"customer_id","name":"Customer","type":"lookup",
                   "required":false,"unique":false,
                   "lookup":{"objectId":5,"displayField":"name"}}
                ]""";
        List<LookupResolver.LookupFieldDef> result = resolver.parseSchemaLookups(schema);
        assertEquals(1, result.size());
        assertEquals(5L, result.get(0).targetObjectId());
    }
}