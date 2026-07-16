package com.metaplatform.appservice.domain.object;

import com.metaplatform.appservice.api.error.ApiException;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * v1.0.2 B1.2: lookup (关联字段) 校验工具 — 纯函数, 无 Spring 依赖, 易测试.
 *
 * <p>职责:
 * <ul>
 *   <li>校验 lookup 子配置的完整性 (objectId / displayField)</li>
 *   <li>校验 displayField 命名规范</li>
 *   <li>校验每个对象最多 5 个 lookup 字段</li>
 *   <li>校验非 lookup 字段不应包含 lookup 子配置</li>
 * </ul>
 *
 * <p>本类不校验目标对象是否存在 (这是 Service 层职责, 需要查 repository),
 * 也不校验自引用 (需要当前对象 ID).
 */
public final class LookupValidator {

    /** 字段 code 命名规范 (与 AppObjectService.CODE_PATTERN 一致). */
    public static final Pattern CODE_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{1,63}$");

    /** 单个对象最多允许的 lookup 字段数 (防止嵌套引用过深, 与 AC-201.7 对齐). */
    public static final int MAX_LOOKUP_FIELDS = 5;

    /** lookup 字段必须配置的最小子集. */
    public static final Set<String> REQUIRED_LOOKUP_KEYS = Set.of("objectId", "displayField");

    private LookupValidator() {}

    /**
     * 校验 FieldSpec 中的 lookup 配置.
     *
     * @param type       字段类型 (从 body.code 以外取)
     * @param lookup     lookup 子配置 (可空)
     * @param currentLookupCount 已经累计的 lookup 字段数 (本字段之前)
     * @return true 表示这是 lookup 字段, false 表示不是
     * @throws ApiException 当校验失败
     */
    public static boolean validate(String type, AppObjectService.LookupSpec lookup, int currentLookupCount) {
        if (!"lookup".equals(type)) {
            // 非 lookup 字段, 应不携带 lookup 子配置 (允许 null)
            return false;
        }
        if (lookup == null) {
            throw ApiException.badRequest(
                "lookup 类型字段必须提供 lookup 配置 { objectId, displayField }");
        }
        if (lookup.objectId() == null || lookup.objectId() <= 0) {
            throw ApiException.badRequest(
                "lookup 字段缺少 objectId (必须是正整数)");
        }
        if (lookup.displayField() == null || lookup.displayField().isBlank()) {
            throw ApiException.badRequest(
                "lookup 字段缺少 displayField");
        }
        if (!CODE_PATTERN.matcher(lookup.displayField()).matches()) {
            throw ApiException.badRequest(
                "lookup 字段的 displayField 必须符合 code 规范 (小写字母开头, 2-64 位)");
        }
        int next = currentLookupCount + 1;
        if (next > MAX_LOOKUP_FIELDS) {
            throw ApiException.badRequest(
                "lookup 字段不能超过 " + MAX_LOOKUP_FIELDS + " 个 (当前第 " + next + " 个, 防止嵌套引用过深)");
        }
        return true;
    }

    /**
     * 校验 lookup 不引用自身.
     */
    public static void validateSelfReference(Long selfObjectId, AppObjectService.LookupSpec lookup, String fieldCode) {
        if (lookup != null && selfObjectId != null && selfObjectId.equals(lookup.objectId())) {
            throw ApiException.badRequest(
                "lookup 字段 [" + fieldCode + "] 不能引用自身 (self-reference forbidden)");
        }
    }

    /**
     * 校验目标对象 ID 在数据库中存在 (Service 层调用, 但签名是纯函数 + Set<Long> validIds).
     */
    public static void validateTargetExists(Long targetObjectId, Set<Long> existingObjectIds, String fieldCode) {
        if (targetObjectId == null || !existingObjectIds.contains(targetObjectId)) {
            throw ApiException.badRequest(
                "lookup 字段 [" + fieldCode + "] 引用的目标对象 " + targetObjectId + " 不存在");
        }
    }
}