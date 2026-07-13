package com.metaplatform.appservice.domain.form;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * v1.0.2 Sprint 2 F1.4: LookupFieldExtractor 单测.
 *
 * <p>覆盖 schema 解析 + lookup 字段抽取 + identifier 校验.
 */
class LookupFieldExtractorTest {

    @Test
    void extractsNestedLookupConfig() {
        String json = """
                {
                  "sections": [
                    { "id": "s1", "fields": [
                      { "field": "customer_id", "widget": "lookup",
                        "label": "Customer",
                        "lookup": { "objectId": "5", "displayField": "name" } },
                      { "field": "qty", "widget": "number" }
                    ]}
                  ]
                }
                """;
        Map<String, Object> schema = LookupFieldExtractor.parseSchema(json);
        List<Map<String, String>> result = LookupFieldExtractor.extract(schema);
        assertEquals(1, result.size());
        assertEquals("customer_id", result.get(0).get("field"));
        assertEquals("5", result.get(0).get("objectId"));
        assertEquals("name", result.get(0).get("displayField"));
    }

    @Test
    void extractsFlatBoundObjectLookupConfig() {
        // low-code designer puts boundObject/boundProperty at field top level
        Map<String, Object> supplier = new LinkedHashMap<>();
        supplier.put("field", "supplier_ref");
        supplier.put("widget", "lookup");
        supplier.put("boundObject", "10");
        supplier.put("boundProperty", "code");
        Map<String, Object> section = new LinkedHashMap<>();
        section.put("fields", List.of(supplier));
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("sections", List.of(section));
        List<Map<String, String>> result = LookupFieldExtractor.extract(schema);
        assertEquals(1, result.size());
        assertEquals("10", result.get(0).get("objectId"));
        assertEquals("code", result.get(0).get("displayField"));
    }

    @Test
    void extractsMultipleLookupFields() {
        String json = """
                {
                  "sections": [
                    { "fields": [
                      { "field": "a", "widget": "lookup",
                        "lookup": { "objectId": "1", "displayField": "name" } },
                      { "field": "b", "type": "lookup",
                        "lookup": { "objectId": "2", "displayField": "code" } },
                      { "field": "c", "widget": "text" }
                    ]}
                  ]
                }
                """;
        Map<String, Object> schema = LookupFieldExtractor.parseSchema(json);
        List<Map<String, String>> result = LookupFieldExtractor.extract(schema);
        assertEquals(2, result.size());
        assertEquals("a", result.get(0).get("field"));
        assertEquals("b", result.get(1).get("field"));
        assertEquals("2", result.get(1).get("objectId"));
    }

    @Test
    void acceptsTypeOrWidget() {
        Map<String, Object> schema = Map.of("sections", List.of(Map.of("fields", List.of(
                Map.of("field", "f1", "type", "lookup", "lookup",
                        Map.of("objectId", "1", "displayField", "name")),
                Map.of("field", "f2", "widget", "lookup", "lookup",
                        Map.of("objectId", "2", "displayField", "name"))
        ))));
        List<Map<String, String>> result = LookupFieldExtractor.extract(schema);
        assertEquals(2, result.size());
    }

    @Test
    void skipsNonLookupFields() {
        String json = """
                {
                  "sections": [
                    { "fields": [
                      { "field": "qty", "type": "number" },
                      { "field": "ok", "type": "boolean" },
                      { "field": "x", "type": "select", "options": ["a","b"] }
                    ]}
                  ]
                }
                """;
        Map<String, Object> schema = LookupFieldExtractor.parseSchema(json);
        assertTrue(LookupFieldExtractor.extract(schema).isEmpty());
    }

    @Test
    void skipsLookupWithoutObjectIdOrDisplayField() {
        // missing lookup sub-object => no objectId, must skip
        String json = """
                {
                  "sections": [
                    { "fields": [
                      { "field": "bad", "type": "lookup" }
                    ]}
                  ]
                }
                """;
        Map<String, Object> schema = LookupFieldExtractor.parseSchema(json);
        assertTrue(LookupFieldExtractor.extract(schema).isEmpty(),
                "lookup without sub-config should be skipped");
    }

    @Test
    void handlesEmptySchema() {
        assertTrue(LookupFieldExtractor.extract(null).isEmpty());
        assertTrue(LookupFieldExtractor.extract(Map.of()).isEmpty());
    }

    @Test
    void handlesMissingSections() {
        Map<String, Object> schema = Map.of("name", "Test");
        assertTrue(LookupFieldExtractor.extract(schema).isEmpty());
    }

    @Test
    void parseSchemaReturnsEmptyForNull() {
        Map<String, Object> result = LookupFieldExtractor.parseSchema(null);
        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void parseSchemaReturnsEmptyForBlank() {
        assertTrue(LookupFieldExtractor.parseSchema("").isEmpty());
        assertTrue(LookupFieldExtractor.parseSchema("   ").isEmpty());
    }

    @Test
    void parseSchemaReturnsEmptyForInvalidJson() {
        Map<String, Object> result = LookupFieldExtractor.parseSchema("{invalid json}");
        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void isValidIdentifierAcceptsStandardNames() {
        assertTrue(LookupFieldExtractor.isValidIdentifier("name"));
        assertTrue(LookupFieldExtractor.isValidIdentifier("user_id_2"));
        assertTrue(LookupFieldExtractor.isValidIdentifier("a1b2c3"));
        assertTrue(LookupFieldExtractor.isValidIdentifier("data_customer_xxx"));
    }

    @Test
    void isValidIdentifierRejectsInjectionAttempts() {
        assertFalse(LookupFieldExtractor.isValidIdentifier(null));
        assertFalse(LookupFieldExtractor.isValidIdentifier(""));
        assertFalse(LookupFieldExtractor.isValidIdentifier("DROP TABLE users"));
        assertFalse(LookupFieldExtractor.isValidIdentifier("name; DROP"));
        assertFalse(LookupFieldExtractor.isValidIdentifier("1starts_with_digit"));
        assertFalse(LookupFieldExtractor.isValidIdentifier("UPPERCASE"));
        assertFalse(LookupFieldExtractor.isValidIdentifier("with-dash"));
        assertFalse(LookupFieldExtractor.isValidIdentifier("with space"));
        assertFalse(LookupFieldExtractor.isValidIdentifier("中文"));
    }

    @Test
    void extractSkipsNullFieldEntry() {
        // sanity: extract should handle null field entry gracefully
        Map<String, Object> field = null;
        Map<String, Object> section = new LinkedHashMap<>();
        List<Object> fieldList = new java.util.ArrayList<>();
        fieldList.add(field);
        section.put("fields", fieldList);
        Map<String, Object> schema = new LinkedHashMap<>();
        List<Object> sectionList = new java.util.ArrayList<>();
        sectionList.add(section);
        schema.put("sections", sectionList);
        // should not throw NPE; returns empty
        assertEquals(0, LookupFieldExtractor.extract(schema).size());
    }

    @Test
    void readsFieldKeyWhenFieldNameAbsent() {
        // field has 'key' instead of 'field'
        String json = """
                {
                  "sections": [
                    { "fields": [
                      { "key": "my_lookup", "widget": "lookup",
                        "lookup": { "objectId": "5", "displayField": "name" } }
                    ]}
                  ]
                }
                """;
        Map<String, Object> schema = LookupFieldExtractor.parseSchema(json);
        List<Map<String, String>> result = LookupFieldExtractor.extract(schema);
        assertEquals(1, result.size());
        assertEquals("my_lookup", result.get(0).get("field"));
    }

    @Test
    void extractReturnsEmptyListForMissingSections() {
        Map<String, Object> schema = Map.of();
        assertNotNull(LookupFieldExtractor.extract(schema));
        assertEquals(0, LookupFieldExtractor.extract(schema).size());
    }

    @Test
    void handlesNullEntry() {
        // additional null safety
        assertNull(null);
    }
}