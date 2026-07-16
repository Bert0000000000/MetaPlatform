package com.metaplatform.appservice.domain.object;

import com.metaplatform.appservice.api.error.ApiException;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * B1.2 lookup 字段校验 — 单元测试.
 *
 * <p>覆盖:
 *  - 非 lookup 字段: 应通过校验, 返回 false
 *  - lookup 字段: 必填 objectId / displayField, displayField 命名规范
 *  - 最多 5 个 lookup 字段 (AC-201.7)
 *  - 自引用禁止
 *  - 目标对象存在性校验
 */
class LookupValidatorTest {

    // ──────────────────────────────────────────────────────────
    // 非 lookup 字段
    // ──────────────────────────────────────────────────────────

    @Test
    void nonLookupType_returnsFalse_noLookupRequired() {
        boolean isLookup = LookupValidator.validate("string", null, 0);
        assertFalse(isLookup);
    }

    @Test
    void numberType_returnsFalse() {
        assertFalse(LookupValidator.validate("number", null, 0));
    }

    @Test
    void lookupType_withNullConfig_throws() {
        var ex = assertThrows(ApiException.class,
                () -> LookupValidator.validate("lookup", null, 0));
        assertEquals(400, ex.getCode());
        assertTrue(ex.getMessage().contains("lookup 配置"));
    }

    // ──────────────────────────────────────────────────────────
    // lookup 字段 - 完整配置
    // ──────────────────────────────────────────────────────────

    @Test
    void lookup_validConfig_returnsTrue() {
        var lookup = new AppObjectService.LookupSpec(1L, "name");
        boolean isLookup = LookupValidator.validate("lookup", lookup, 0);
        assertTrue(isLookup);
    }

    @Test
    void lookup_validConfig_count2_returnsTrue() {
        var lookup = new AppObjectService.LookupSpec(1L, "name");
        boolean isLookup = LookupValidator.validate("lookup", lookup, 1);
        assertTrue(isLookup);
    }

    // ──────────────────────────────────────────────────────────
    // objectId 校验
    // ──────────────────────────────────────────────────────────

    @Test
    void lookup_nullObjectId_throws() {
        var lookup = new AppObjectService.LookupSpec(null, "name");
        var ex = assertThrows(ApiException.class,
                () -> LookupValidator.validate("lookup", lookup, 0));
        assertTrue(ex.getMessage().contains("objectId"));
    }

    @Test
    void lookup_zeroObjectId_throws() {
        var lookup = new AppObjectService.LookupSpec(0L, "name");
        var ex = assertThrows(ApiException.class,
                () -> LookupValidator.validate("lookup", lookup, 0));
        assertTrue(ex.getMessage().contains("objectId"));
    }

    @Test
    void lookup_negativeObjectId_throws() {
        var lookup = new AppObjectService.LookupSpec(-1L, "name");
        assertThrows(ApiException.class,
                () -> LookupValidator.validate("lookup", lookup, 0));
    }

    // ──────────────────────────────────────────────────────────
    // displayField 校验
    // ──────────────────────────────────────────────────────────

    @Test
    void lookup_nullDisplayField_throws() {
        var lookup = new AppObjectService.LookupSpec(1L, null);
        var ex = assertThrows(ApiException.class,
                () -> LookupValidator.validate("lookup", lookup, 0));
        assertTrue(ex.getMessage().contains("displayField"));
    }

    @Test
    void lookup_blankDisplayField_throws() {
        var lookup = new AppObjectService.LookupSpec(1L, "   ");
        assertThrows(ApiException.class,
                () -> LookupValidator.validate("lookup", lookup, 0));
    }

    @Test
    void lookup_displayFieldStartsWithUpperCase_throws() {
        var lookup = new AppObjectService.LookupSpec(1L, "Name");
        var ex = assertThrows(ApiException.class,
                () -> LookupValidator.validate("lookup", lookup, 0));
        assertTrue(ex.getMessage().contains("displayField"));
    }

    @Test
    void lookup_displayFieldTooShort_throws() {
        // CODE_PATTERN 要求至少 2 位 (首字符 + 1)
        var lookup = new AppObjectService.LookupSpec(1L, "x");
        assertThrows(ApiException.class,
                () -> LookupValidator.validate("lookup", lookup, 0));
    }

    @Test
    void lookup_displayFieldWithDash_throws() {
        var lookup = new AppObjectService.LookupSpec(1L, "display-field");
        assertThrows(ApiException.class,
                () -> LookupValidator.validate("lookup", lookup, 0));
    }

    @Test
    void lookup_displayFieldWithChinese_throws() {
        var lookup = new AppObjectService.LookupSpec(1L, "名称");
        assertThrows(ApiException.class,
                () -> LookupValidator.validate("lookup", lookup, 0));
    }

    @Test
    void lookup_displayFieldWithUnderscore_ok() {
        var lookup = new AppObjectService.LookupSpec(1L, "first_name");
        assertTrue(LookupValidator.validate("lookup", lookup, 0));
    }

    @Test
    void lookup_displayFieldWithNumber_ok() {
        var lookup = new AppObjectService.LookupSpec(1L, "field1");
        assertTrue(LookupValidator.validate("lookup", lookup, 0));
    }

    // ──────────────────────────────────────────────────────────
    // 最多 5 个 lookup 字段 (AC-201.7)
    // ──────────────────────────────────────────────────────────

    @Test
    void lookup_count5_accepted() {
        var lookup = new AppObjectService.LookupSpec(1L, "name");
        // currentLookupCount=4, 此次将变成 5 (临界值)
        assertTrue(LookupValidator.validate("lookup", lookup, 4));
    }

    @Test
    void lookup_count6_throws() {
        var lookup = new AppObjectService.LookupSpec(1L, "name");
        // currentLookupCount=5, 此次将变成 6 → 超出上限
        var ex = assertThrows(ApiException.class,
                () -> LookupValidator.validate("lookup", lookup, 5));
        assertTrue(ex.getMessage().contains("5"));
        assertTrue(ex.getMessage().contains("嵌套"));
    }

    // ──────────────────────────────────────────────────────────
    // 自引用校验
    // ──────────────────────────────────────────────────────────

    @Test
    void selfReference_throws() {
        var lookup = new AppObjectService.LookupSpec(100L, "name");
        var ex = assertThrows(ApiException.class,
                () -> LookupValidator.validateSelfReference(100L, lookup, "self_field"));
        assertTrue(ex.getMessage().contains("自身"));
    }

    @Test
    void notSelfReference_passes() {
        var lookup = new AppObjectService.LookupSpec(200L, "name");
        assertDoesNotThrow(() -> LookupValidator.validateSelfReference(100L, lookup, "other_field"));
    }

    @Test
    void selfReference_nullLookup_passes() {
        // 无 lookup 时应通过
        assertDoesNotThrow(() -> LookupValidator.validateSelfReference(100L, null, "x"));
    }

    @Test
    void selfReference_nullSelfOid_passes() {
        // 自我 ID 未分配时不校验
        var lookup = new AppObjectService.LookupSpec(100L, "name");
        assertDoesNotThrow(() -> LookupValidator.validateSelfReference(null, lookup, "x"));
    }

    // ──────────────────────────────────────────────────────────
    // 目标对象存在性校验
    // ──────────────────────────────────────────────────────────

    @Test
    void targetExists_returnsOk() {
        var existing = Set.of(10L, 20L, 30L);
        assertDoesNotThrow(() -> LookupValidator.validateTargetExists(20L, existing, "field1"));
    }

    @Test
    void targetNotExists_throws() {
        var existing = Set.of(10L, 20L, 30L);
        var ex = assertThrows(ApiException.class,
                () -> LookupValidator.validateTargetExists(999L, existing, "field1"));
        assertTrue(ex.getMessage().contains("不存在"));
        assertTrue(ex.getMessage().contains("999"));
    }

    @Test
    void targetNull_throws() {
        var existing = Set.of(10L);
        assertThrows(ApiException.class,
                () -> LookupValidator.validateTargetExists(null, existing, "f"));
    }

    @Test
    void targetExists_emptySet_throws() {
        // 空集合意味着目标不存在
        assertThrows(ApiException.class,
                () -> LookupValidator.validateTargetExists(20L, Set.of(), "f"));
    }

    // ──────────────────────────────────────────────────────────
    // 常量
    // ──────────────────────────────────────────────────────────

    @Test
    void maxLookupFields_is5() {
        assertEquals(5, LookupValidator.MAX_LOOKUP_FIELDS);
    }
}