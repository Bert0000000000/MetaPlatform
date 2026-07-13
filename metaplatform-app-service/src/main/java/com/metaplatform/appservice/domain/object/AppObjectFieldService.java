package com.metaplatform.appservice.domain.object;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.app.AppService;
import com.metaplatform.appservice.domain.dynamic.DynamicTableService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * 对象字段领域服务。
 *
 * <p>设计约束：
 * <ul>
 *   <li>字段 code 在同一对象下唯一，且符合 [a-z][a-z0-9_]{0,62}。</li>
 *   <li>首次添加字段时，为对象创建物理数据表；后续新增字段通过 ALTER TABLE 追加。</li>
 *   <li>删除/修改字段仅更新元数据；不删除历史物理列（避免数据丢失）。</li>
 * </ul>
 *
 * <p>v1.0.2：appId 参数同时支持数字 ID 与字符串 code（slug）。
 */
@Service
public class AppObjectFieldService {

    private static final java.util.regex.Pattern CODE_PATTERN =
            java.util.regex.Pattern.compile("^[a-z][a-z0-9_]{0,62}$");

    private static final Set<String> SUPPORTED_TYPES = Set.of(
            "text", "longtext", "number", "boolean", "date", "datetime",
            "select", "multiselect", "email", "phone", "lookup"
    );

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final AppObjectRepository objectRepository;
    private final DynamicTableService dynamicTableService;
    private final AppService appService;

    public AppObjectFieldService(AppObjectRepository objectRepository,
                                 DynamicTableService dynamicTableService,
                                 AppService appService) {
        this.objectRepository = objectRepository;
        this.dynamicTableService = dynamicTableService;
        this.appService = appService;
    }

    @Transactional(readOnly = true)
    public List<FieldView> list(String appRef, Long oid) {
        var entity = getObject(appRef, oid);
        return parseSchema(entity.getSchemaJson());
    }

    @Transactional
    public List<FieldView> add(String appRef, Long oid, FieldRequest req, Integer expectedVersion) {
        var entity = getObject(appRef, oid);
        assertVersionMatches(entity, expectedVersion);
        validate(req);

        List<FieldView> fields = parseSchema(entity.getSchemaJson());
        if (fields.stream().anyMatch(f -> f.code().equals(req.code()))) {
            throw ApiException.conflict("字段 code 已存在: " + req.code());
        }

        // v1.0.2 B1.3: lookup 字段校验 (限 5 个 / 对象)
        int existingLookups = (int) fields.stream()
                .filter(f -> "lookup".equals(f.type()))
                .count();
        AppObjectService.LookupSpec lookupSpec = null;
        if ("lookup".equals(req.type())) {
            LookupValidator.validate(req.type(), toLookupSpec(req.lookup()), existingLookups);
            // 目标对象存在性
            validateLookupTargetExists(toLookupSpec(req.lookup()), req.code());
            lookupSpec = toLookupSpec(req.lookup());
        }

        FieldView newField = new FieldView(
                req.code(), req.name(), req.type(),
                Boolean.TRUE.equals(req.required()),
                req.description(), req.defaultValue(),
                Boolean.TRUE.equals(req.unique()),
                "lookup".equals(req.type()) ? req.lookup() : null
        );
        fields.add(newField);

        ensureDataTableColumn(entity, newField, lookupSpec);

        entity.setSchemaJson(writeSchema(fields));
        entity.setVersion(entity.getVersion() + 1);
        objectRepository.save(entity);
        return fields;
    }

    @Transactional
    public List<FieldView> update(String appRef, Long oid, String code, FieldRequest req, Integer expectedVersion) {
        var entity = getObject(appRef, oid);
        assertVersionMatches(entity, expectedVersion);
        List<FieldView> fields = parseSchema(entity.getSchemaJson());
        int idx = indexOf(fields, code);
        FieldView old = fields.get(idx);

        // 类型不可变更；其余允许更新 (v1.0.2 AC-103.5)
        FieldView updated = new FieldView(
                code,
                req.name() != null ? req.name() : old.name(),
                old.type(),
                req.required() != null ? req.required() : old.required(),
                req.description() != null ? req.description() : old.description(),
                req.defaultValue() != null ? req.defaultValue() : old.defaultValue(),
                req.unique() != null ? req.unique() : old.unique(),
                // v1.0.2 B1.3: lookup 配置不可修改 (字段类型锁定 AC-103.5)
                old.lookup()
        );
        fields.set(idx, updated);

        entity.setSchemaJson(writeSchema(fields));
        entity.setVersion(entity.getVersion() + 1);
        objectRepository.save(entity);
        return fields;
    }

    @Transactional
    public List<FieldView> delete(String appRef, Long oid, String code, Integer expectedVersion) {
        var entity = getObject(appRef, oid);
        assertVersionMatches(entity, expectedVersion);
        List<FieldView> fields = parseSchema(entity.getSchemaJson());
        if (!fields.removeIf(f -> f.code().equals(code))) {
            throw ApiException.notFound("字段 " + code + " 不存在");
        }
        entity.setSchemaJson(writeSchema(fields));
        entity.setVersion(entity.getVersion() + 1);
        objectRepository.save(entity);
        return fields;
    }

    /** AC-103.6: If-Match 校验 — 期望版本与当前不一致时抛 412. */
    private void assertVersionMatches(AppObjectEntity entity, Integer expectedVersion) {
        if (expectedVersion == null) return;
        if (!expectedVersion.equals(entity.getVersion())) {
            throw ApiException.preconditionFailed(
                "对象版本不匹配: 当前=" + entity.getVersion() + ", 期望=" + expectedVersion
                    + " (对象已被他人修改，请刷新后重试)");
        }
    }

    private AppObjectEntity getObject(String appRef, Long oid) {
        Long appId = appService.resolveByIdOrCode(appRef).getId();
        return objectRepository.findByIdAndAppId(oid, appId)
                .orElseThrow(() -> ApiException.notFound("对象 " + oid + " 不存在"));
    }

    private void validate(FieldRequest req) {
        if (req.code() == null || !CODE_PATTERN.matcher(req.code()).matches()) {
            throw ApiException.badRequest("字段 code 必须为 1-63 位小写字母/数字/下划线且以字母开头");
        }
        if (req.name() == null || req.name().isBlank() || req.name().length() > 255) {
            throw ApiException.badRequest("字段 name 不能为空且不超过 255 字");
        }
        if (req.type() == null || !SUPPORTED_TYPES.contains(req.type())) {
            throw ApiException.badRequest("不支持的字段类型: " + req.type());
        }
        // v1.0.2 B1.3: lookup 字段强校验 (必填 lookup 子对象)
        if ("lookup".equals(req.type())) {
            if (req.lookup() == null) {
                throw ApiException.badRequest(
                    "lookup 字段 [" + req.code() + "] 必须提供 lookup 配置 { objectId, displayField }");
            }
        }
    }

    private void ensureDataTableColumn(AppObjectEntity entity, FieldView field, AppObjectService.LookupSpec lookup) {
        var def = new AppObjectService.FieldDef(
                field.code(), field.name(), toBackendType(field.type()), field.required(), field.unique(),
                lookup
        );
        if (entity.getDataTableName() == null || entity.getDataTableName().isBlank()) {
            String tableName = dynamicTableService.createTable(entity.getCode(), List.of(def));
            entity.setDataTableName(tableName);
        } else {
            dynamicTableService.addColumn(entity.getDataTableName(), def);
        }
    }

    /** v1.0.2 B1.3: 转换 LookupRequest → LookupSpec. */
    private AppObjectService.LookupSpec toLookupSpec(LookupRequest req) {
        if (req == null) return null;
        return new AppObjectService.LookupSpec(req.objectId(), req.displayField());
    }

    /** v1.0.2 B1.3: 校验 lookup 引用的目标对象存在. */
    private void validateLookupTargetExists(AppObjectService.LookupSpec lookup, String fieldCode) {
        if (lookup == null || lookup.objectId() == null) return;
        var target = objectRepository.findById(lookup.objectId()).orElse(null);
        if (target == null) {
            throw ApiException.badRequest(
                "lookup 字段 [" + fieldCode + "] 引用的目标对象 " + lookup.objectId() + " 不存在");
        }
    }

    private int indexOf(List<FieldView> fields, String code) {
        for (int i = 0; i < fields.size(); i++) {
            if (fields.get(i).code().equals(code)) return i;
        }
        throw ApiException.notFound("字段 " + code + " 不存在");
    }

    private List<FieldView> parseSchema(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return MAPPER.readValue(json, new TypeReference<List<FieldView>>() {});
        } catch (Exception e) {
            throw ApiException.internalError("字段 schema 解析失败: " + e.getMessage());
        }
    }

    private String writeSchema(List<FieldView> fields) {
        try {
            return MAPPER.writeValueAsString(fields);
        } catch (Exception e) {
            throw ApiException.internalError("字段 schema 序列化失败: " + e.getMessage());
        }
    }

    static String toBackendType(String frontendType) {
        return switch (frontendType) {
            case "number" -> "number";
            case "boolean" -> "boolean";
            case "date" -> "date";
            case "datetime" -> "datetime";
            default -> "string"; // text, longtext, select, multiselect, email, phone
        };
    }

    public record FieldView(
            String code,
            String name,
            String type,
            Boolean required,
            String description,
            String defaultValue,
            Boolean unique,
            // v1.0.2 B1.3: lookup 字段子配置 (type=lookup 时存在)
            LookupRequest lookup
    ) {}

    public record FieldRequest(
            @NotBlank @Pattern(regexp = "^[a-z][a-z0-9_]{0,62}$") String code,
            @NotBlank @Size(max = 255) String name,
            @NotBlank String type,
            Boolean required,
            @Size(max = 500) String description,
            @Size(max = 500) String defaultValue,
            Boolean unique,
            // v1.0.2 B1.3: lookup 字段配置 (type=lookup 时必填)
            LookupRequest lookup
    ) {}

    /**
     * v1.0.2 B1.3: lookup 字段请求子对象.
     */
    public record LookupRequest(Long objectId, String displayField) {}
}
