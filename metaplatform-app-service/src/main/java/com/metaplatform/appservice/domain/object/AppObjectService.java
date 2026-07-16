package com.metaplatform.appservice.domain.object;

import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.api.page.PageParams;
import com.metaplatform.appservice.api.page.PageResult;
import com.metaplatform.appservice.domain.app.AppEntity;
import com.metaplatform.appservice.domain.app.AppRepository;
import com.metaplatform.appservice.domain.app.AppService;
import com.metaplatform.appservice.domain.dynamic.DynamicTableService;
import com.metaplatform.appservice.domain.ontology.OntologyClient;
import com.metaplatform.appservice.domain.ontology.OntologyFieldSpec;
import com.metaplatform.appservice.security.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 对象（AppObject）领域服务 —— Sprint 1 范围。
 *
 * <p>职责链：参数校验 → ontology-engine 注册 → app-service 动态建表 → 元数据落库。
 * 任一步失败回滚。
 *
 * <p>v1.0.2：appId 参数同时支持数字 ID 与字符串 code（slug），以兼容前端 URL 中的 Node 应用 ID。
 */
@Service
public class AppObjectService {

    private static final Pattern CODE_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{1,63}$");
    private static final Set<String> ALLOWED_TYPES =
            Set.of("string", "longtext", "number", "boolean", "date", "datetime", "enum",
                    "text", "select", "multiselect", "email", "phone", "lookup");
    public static final int MAX_FIELDS = 50;
    /** v1.0.2 B1.2: 单个对象最多 5 个 lookup 字段, 防止嵌套引用过深. */
    public static final int MAX_LOOKUP_FIELDS = 5;

    private final AppRepository appRepository;
    private final AppObjectRepository repository;
    private final OntologyClient ontologyClient;
    private final DynamicTableService dynamicTableService;
    private final AppService appService;

    public AppObjectService(AppRepository appRepository,
                            AppObjectRepository repository,
                            OntologyClient ontologyClient,
                            DynamicTableService dynamicTableService,
                            AppService appService) {
        this.appRepository = appRepository;
        this.repository = repository;
        this.ontologyClient = ontologyClient;
        this.dynamicTableService = dynamicTableService;
        this.appService = appService;
    }

    @Transactional(readOnly = true)
    public List<AppObjectEntity> list(String appRef) {
        Long appId = resolveAppId(appRef);
        return repository.findByAppIdOrderById(appId);
    }

    /**
     * v1.0.2 B1.1: 分页查询对象列表.
     *
     * <p>排序固定按 id ASC (与 v1.0.1 全量查询行为一致).
     * 客户端无需关心 sort 参数 (后续 Sprint 3 行级权限 / 列表增强再扩展).
     *
     * @param appRef 应用 ID 或 code
     * @param params 分页参数 (page 1-based, size 1-500)
     * @return 分页结果
     */
    @Transactional(readOnly = true)
    public PageResult<AppObjectEntity> listPaged(String appRef, PageParams params) {
        Long appId = resolveAppId(appRef);
        var pageable = PageRequest.of(
                params.zeroBasedPage(),
                params.size(),
                Sort.by(Sort.Direction.ASC, "id"));
        var page = repository.findByAppId(appId, pageable);
        return PageResult.from(page);
    }

    @Transactional(readOnly = true)
    public AppObjectEntity get(String appRef, Long oid) {
        Long appId = resolveAppId(appRef);
        return repository.findByIdAndAppId(oid, appId)
                .orElseThrow(() -> ApiException.notFound("对象 " + oid + " 不存在"));
    }

    @Transactional
    public AppObjectEntity create(String appRef, AppObjectCreateRequest req) {
        Long appId = ensureAppId(appRef);
        // 1. 参数校验
        validateCode(req.code());
        validateName(req.name());
        if (req.fields() != null && req.fields().size() > MAX_FIELDS) {
            throw ApiException.badRequest("字段数不能超过 " + MAX_FIELDS);
        }

        List<FieldDef> fieldDefs = new ArrayList<>();
        List<FieldSpec> inputFields = req.fields() == null ? List.of() : req.fields();
        int lookupCount = 0;
        for (var f : inputFields) {
            if (!ALLOWED_TYPES.contains(f.type())) {
                throw ApiException.badRequest("非法字段类型: " + f.type() + "，可选: " + ALLOWED_TYPES);
            }
            if (f.code() == null || !CODE_PATTERN.matcher(f.code()).matches()) {
                throw ApiException.badRequest("非法字段 code: " + f.code());
            }
            // v1.0.2 B1.2: lookup 字段强校验 (委托给 LookupValidator 纯函数, 易单测)
            LookupSpec lookup = null;
            if (LookupValidator.validate(f.type(), f.lookup(), lookupCount)) {
                lookup = f.lookup();
                lookupCount++;
            }
            boolean required = Boolean.TRUE.equals(f.required());
            boolean unique = Boolean.TRUE.equals(f.unique());
            fieldDefs.add(new FieldDef(f.code(), f.name(), f.type(), required, unique, lookup));
        }
        String schemaJson = writeSchemaJson(fieldDefs);

        // v1.0.2 B1.2: 校验 lookup 目标对象存在 (跨对象引用)
        validateLookupTargetExists(fieldDefs);

        String ontologyObjectId = null;
        String tableName = null;
        if (!fieldDefs.isEmpty()) {
            try {
                // 2. ontology-engine 注册
                ontologyObjectId = ontologyClient.createObjectType(req.code(), req.name(),
                        fieldDefs.stream().map(f ->
                                new OntologyFieldSpec(f.code(), f.name(), toOntologyType(f.type()), f.required())).toList());
                // 3. 动态建表
                tableName = dynamicTableService.createTable(req.code(), fieldDefs);
            } catch (Exception e) {
                throw ApiException.badRequest("注册对象失败: " + e.getMessage());
            }
        }

        // 4. 落 app_objects 表
        var app = appRepository.findByIdAndTenantId(appId, TenantContext.required())
                .orElseThrow(() -> ApiException.notFound("应用 " + appId + " 不存在"));

        AppObjectEntity entity = new AppObjectEntity();
        entity.setAppId(appId);
        entity.setCode(req.code());
        entity.setName(req.name());
        entity.setDescription(req.description());
        entity.setSchemaJson(schemaJson);
        entity.setDataTableName(tableName);
        entity.setOntologyObjectId(ontologyObjectId);
        entity.setCreatedBy("dev-user");

        try {
            var saved = repository.save(entity);
            // v1.0.2 B1.2: save 后校验 lookup 自引用 (因为此时 selfOid 已分配)
            validateLookupSelfReference(saved.getId(), fieldDefs);
            return saved;
        } catch (DataIntegrityViolationException e) {
            // 回滚 ontology + drop data table
            safeDrop(tableName);
            safeOntologyDrop(ontologyObjectId);
            throw ApiException.conflict("对象 code 已存在: " + req.code());
        }
    }

    @Transactional
    public AppObjectEntity update(String appRef, Long oid, AppObjectUpdateRequest req, Integer expectedVersion) {
        var entity = get(appRef, oid);
        // AC-103.6: If-Match / ETag 乐观锁校验
        //   - expectedVersion 为 null  → 不做校验 (向后兼容)
        //   - expectedVersion 非空且不等于当前 version → 412 Precondition Failed
        if (expectedVersion != null && !expectedVersion.equals(entity.getVersion())) {
            throw ApiException.preconditionFailed(
                "对象版本不匹配: 当前=" + entity.getVersion() + ", 期望=" + expectedVersion
                    + " (对象已被他人修改，请刷新后重试)");
        }
        if (req.fields() != null && !req.fields().isEmpty()) {
            throw ApiException.badRequest("本版本不支持修改 fields；请删除重建");
        }
        if (req.name() != null) validateName(req.name());
        if (req.name() != null) entity.setName(req.name());
        if (req.description() != null) entity.setDescription(req.description());
        entity.setVersion(entity.getVersion() + 1);
        return repository.save(entity);
    }

    @Transactional
    public void delete(String appRef, Long oid) {
        var entity = get(appRef, oid);
        safeDrop(entity.getDataTableName());
        // ontology drop 在 Sprint 5 集成时联动
        repository.delete(entity);
    }

    /**
     * 解析 appRef：数字 ID 必须已存在；字符串 code 按 getByCode 解析。
     */
    private Long resolveAppId(String appRef) {
        return appService.resolveByIdOrCode(appRef).getId();
    }

    /**
     * 确保应用存在：数字 ID 必须已存在；字符串 code 不存在时自动创建占位应用。
     */
    private Long ensureAppId(String appRef) {
        try {
            return appService.get(Long.valueOf(appRef)).getId();
        } catch (NumberFormatException ignored) {
            return appService.ensureByCode(appRef).getId();
        }
    }

    private void validateCode(String code) {
        if (code == null || !CODE_PATTERN.matcher(code).matches()) {
            throw ApiException.badRequest("code 必须为 2-64 位小写字母数字下划线（首字符字母）");
        }
    }
    private void validateName(String name) {
        if (name == null || name.isBlank() || name.length() > 255) {
            throw ApiException.badRequest("name 不能为空且不超过 255 字");
        }
    }

    /**
     * v1.0.2 B1.2: 校验目标对象是否存在 (跨对象引用).
     * 委托给 LookupValidator.validateTargetExists, 注入当前所有对象 ID.
     */
    private void validateLookupTargetExists(List<FieldDef> defs) {
        // 收集所有 lookup 字段涉及的 objectId
        Set<Long> targetIds = new java.util.HashSet<>();
        Map<String, AppObjectService.LookupSpec> fieldCode2Lookup = new java.util.HashMap<>();
        for (FieldDef d : defs) {
            if (d.lookup() != null) {
                targetIds.add(d.lookup().objectId());
                fieldCode2Lookup.put(d.code(), d.lookup());
            }
        }
        if (targetIds.isEmpty()) return;
        Set<Long> existing = repository.findAllById(targetIds).stream()
                .map(AppObjectEntity::getId).collect(java.util.stream.Collectors.toSet());
        for (var entry : fieldCode2Lookup.entrySet()) {
            LookupValidator.validateTargetExists(
                    entry.getValue().objectId(), existing, entry.getKey());
        }
    }

    /**
     * v1.0.2 B1.2: 校验 lookup 自引用. 在 create() 落库后调用, 因为此时自身 oid 已分配.
     */
    private void validateLookupSelfReference(Long selfOid, List<FieldDef> defs) {
        for (FieldDef d : defs) {
            LookupValidator.validateSelfReference(selfOid, d.lookup(), d.code());
        }
    }

    private static String toOntologyType(String t) {
        return switch (t) {
            case "string", "longtext", "text", "email", "phone" -> "String";
            case "number" -> "Number";
            case "boolean" -> "Boolean";
            case "date", "datetime" -> "Date";
            case "select", "multiselect", "enum" -> "Enum";
            // v1.0.2 B1.2: lookup 是外键 ID, ontology-engine 视为 Long
            case "lookup" -> "Long";
            default -> "String";
        };
    }

    private static String writeSchemaJson(List<FieldDef> defs) {
        try {
            var mapper = new ObjectMapper();
            var arr = mapper.createArrayNode();
            for (FieldDef d : defs) {
                var o = arr.addObject();
                o.put("code", d.code());
                o.put("name", d.name());
                o.put("type", d.type());
                o.put("required", d.required());
                o.put("unique", Boolean.TRUE.equals(d.unique()));
                // v1.0.2 B1.2: lookup 子配置写入 schema_json
                if (d.lookup() != null) {
                    var lookupNode = o.putObject("lookup");
                    lookupNode.put("objectId", d.lookup().objectId());
                    lookupNode.put("displayField", d.lookup().displayField());
                }
            }
            return arr.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void safeDrop(String tableName) {
        try { dynamicTableService.dropTable(tableName); } catch (Exception ignored) {}
    }
    private void safeOntologyDrop(String id) {
        try { ontologyClient.dropObjectType(id); } catch (Exception ignored) {}
    }

    public record FieldDef(String code, String name, String type, Boolean required, Boolean unique, LookupSpec lookup) {}
    public record FieldSpec(String code, String name, String type, Boolean required, Boolean unique, LookupSpec lookup) {}
    public record AppObjectCreateRequest(String code, String name, String description, List<FieldSpec> fields) {}
    public record AppObjectUpdateRequest(String name, String description, List<FieldSpec> fields) {}

    /**
     * v1.0.2 B1.2: lookup (关联字段) 配置.
     *
     * <p>语义: 当前字段引用 {@code objectId} 指向的目标对象的 {@code displayField}.
     * 数据库存储外键 ID (BIGINT), 列表显示 displayField 值.
     */
    public record LookupSpec(Long objectId, String displayField) {}
}
