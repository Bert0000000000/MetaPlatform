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
            "select", "multiselect", "email", "phone"
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
    public List<FieldView> add(String appRef, Long oid, FieldRequest req) {
        var entity = getObject(appRef, oid);
        validate(req);

        List<FieldView> fields = parseSchema(entity.getSchemaJson());
        if (fields.stream().anyMatch(f -> f.code().equals(req.code()))) {
            throw ApiException.conflict("字段 code 已存在: " + req.code());
        }

        FieldView newField = new FieldView(
                req.code(), req.name(), req.type(),
                Boolean.TRUE.equals(req.required()),
                req.description(), req.defaultValue(),
                Boolean.TRUE.equals(req.unique())
        );
        fields.add(newField);

        ensureDataTableColumn(entity, newField);

        entity.setSchemaJson(writeSchema(fields));
        entity.setVersion(entity.getVersion() + 1);
        objectRepository.save(entity);
        return fields;
    }

    @Transactional
    public List<FieldView> update(String appRef, Long oid, String code, FieldRequest req) {
        var entity = getObject(appRef, oid);
        List<FieldView> fields = parseSchema(entity.getSchemaJson());
        int idx = indexOf(fields, code);
        FieldView old = fields.get(idx);

        // 类型不可变更；其余允许更新
        FieldView updated = new FieldView(
                code,
                req.name() != null ? req.name() : old.name(),
                old.type(),
                req.required() != null ? req.required() : old.required(),
                req.description() != null ? req.description() : old.description(),
                req.defaultValue() != null ? req.defaultValue() : old.defaultValue(),
                req.unique() != null ? req.unique() : old.unique()
        );
        fields.set(idx, updated);

        entity.setSchemaJson(writeSchema(fields));
        entity.setVersion(entity.getVersion() + 1);
        objectRepository.save(entity);
        return fields;
    }

    @Transactional
    public List<FieldView> delete(String appRef, Long oid, String code) {
        var entity = getObject(appRef, oid);
        List<FieldView> fields = parseSchema(entity.getSchemaJson());
        if (!fields.removeIf(f -> f.code().equals(code))) {
            throw ApiException.notFound("字段 " + code + " 不存在");
        }
        entity.setSchemaJson(writeSchema(fields));
        entity.setVersion(entity.getVersion() + 1);
        objectRepository.save(entity);
        return fields;
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
    }

    private void ensureDataTableColumn(AppObjectEntity entity, FieldView field) {
        var def = new AppObjectService.FieldDef(
                field.code(), field.name(), toBackendType(field.type()), field.required(), field.unique()
        );
        if (entity.getDataTableName() == null || entity.getDataTableName().isBlank()) {
            String tableName = dynamicTableService.createTable(entity.getCode(), List.of(def));
            entity.setDataTableName(tableName);
        } else {
            dynamicTableService.addColumn(entity.getDataTableName(), def);
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
            Boolean unique
    ) {}

    public record FieldRequest(
            @NotBlank @Pattern(regexp = "^[a-z][a-z0-9_]{0,62}$") String code,
            @NotBlank @Size(max = 255) String name,
            @NotBlank String type,
            Boolean required,
            @Size(max = 500) String description,
            @Size(max = 500) String defaultValue,
            Boolean unique
    ) {}
}
