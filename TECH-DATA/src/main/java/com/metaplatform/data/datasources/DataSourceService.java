package com.metaplatform.data.datasources;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.config.DataProperties;
import com.metaplatform.data.datasources.dto.CreateDataSourceRequest;
import com.metaplatform.data.datasources.dto.DataSourceResponse;
import com.metaplatform.data.datasources.dto.TestConnectionRequest;
import com.metaplatform.data.datasources.dto.TestConnectionResponse;
import com.metaplatform.data.datasources.dto.UpdateDataSourceRequest;
import com.metaplatform.data.datasources.support.DataSourceManager;
import com.metaplatform.data.entity.DataSourceEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.repository.DataSourceRepository;
import com.metaplatform.data.util.CryptoUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 数据源服务：CRUD + AES 凭证加密 + 连接测试。
 *
 * <p>对应 Python app/services/datasource_service.py 的 DataSourceService。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataSourceService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_INACTIVE = "INACTIVE";
    private static final Set<String> ALLOWED_STATUS = Set.of("ACTIVE", "INACTIVE");
    private static final Set<String> SUPPORTED_SOURCE_TYPES =
            Set.of("postgresql", "mysql", "starrocks", "clickhouse", "hive", "iceberg", "hudi");

    private final DataSourceRepository dataSourceRepository;
    private final ObjectMapper objectMapper;
    private final DataProperties dataProperties;
    private final DataSourceManager dataSourceManager;

    /**
     * 创建数据源。
     */
    @Transactional
    public DataSourceResponse create(CreateDataSourceRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        validateSourceType(request.getSourceType());
        validateStatus(request.getStatus());

        if (dataSourceRepository.existsByTenantIdAndName(tenantId, request.getName())) {
            throw DataException.datasourceNameDuplicate(request.getName());
        }

        DataSourceEntity entity = new DataSourceEntity();
        entity.setId(newDataSourceId());
        entity.setTenantId(tenantId);
        entity.setName(request.getName());
        entity.setSourceType(request.getSourceType());
        entity.setConnectionConfig(encryptConnectionConfig(request.getConnectionConfig()));
        entity.setStatus(request.getStatus() != null ? request.getStatus() : STATUS_ACTIVE);

        DataSourceEntity saved = dataSourceRepository.save(entity);
        log.info("数据源创建 | tenant={} id={} name={} type={}",
                tenantId, saved.getId(), saved.getName(), saved.getSourceType());
        return toResponse(saved);
    }

    /**
     * 列表（分页）。
     */
    @Transactional(readOnly = true)
    public PageResponse<DataSourceResponse> list(String status, String keyword, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<DataSourceEntity> result;
        if (keyword != null && !keyword.isBlank()) {
            result = dataSourceRepository.searchByKeyword(tenantId, keyword.trim(), pageable);
        } else if (status != null && !status.isBlank()) {
            result = dataSourceRepository.findByTenantIdAndStatus(tenantId, status, pageable);
        } else {
            result = dataSourceRepository.findByTenantId(tenantId, pageable);
        }

        return PageResponse.of(result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    /**
     * 详情。
     */
    @Transactional(readOnly = true)
    public DataSourceResponse get(String datasourceId) {
        DataSourceEntity entity = requireDataSource(datasourceId);
        return toResponse(entity);
    }

    /**
     * 更新。
     */
    @Transactional
    public DataSourceResponse update(String datasourceId, UpdateDataSourceRequest request) {
        DataSourceEntity entity = requireDataSource(datasourceId);

        if (request.getName() != null && !request.getName().isBlank()) {
            if (!entity.getName().equals(request.getName())
                    && dataSourceRepository.existsByTenantIdAndName(entity.getTenantId(), request.getName())) {
                throw DataException.datasourceNameDuplicate(request.getName());
            }
            entity.setName(request.getName());
        }
        if (request.getConnectionConfig() != null) {
            entity.setConnectionConfig(encryptConnectionConfig(request.getConnectionConfig()));
        }
        if (request.getStatus() != null) {
            validateStatus(request.getStatus());
            entity.setStatus(request.getStatus());
        }

        DataSourceEntity saved = dataSourceRepository.save(entity);
        // 数据源更新后清理旧连接池，避免使用过期配置
        dataSourceManager.invalidate(datasourceId);
        log.info("数据源更新 | id={} name={}", saved.getId(), saved.getName());
        return toResponse(saved);
    }

    /**
     * 删除。
     */
    @Transactional
    public boolean delete(String datasourceId) {
        DataSourceEntity entity = requireDataSource(datasourceId);
        dataSourceRepository.delete(entity);
        // 数据源删除后清理连接池
        dataSourceManager.invalidate(datasourceId);
        log.info("数据源删除 | id={}", datasourceId);
        return true;
    }

    /**
     * 连接测试：通过 DataSourceManager 执行真实 JDBC 连接测试。
     */
    public TestConnectionResponse testConnection(TestConnectionRequest request) {
        String sourceType;
        Map<String, Object> connConfig;

        if (request.getDatasourceId() != null && !request.getDatasourceId().isBlank()) {
            DataSourceEntity entity = requireDataSource(request.getDatasourceId());
            sourceType = entity.getSourceType();
            connConfig = decryptToMap(entity.getConnectionConfig());
        } else {
            sourceType = request.getSourceType();
            connConfig = request.getConnectionConfig();
            validateSourceType(sourceType);
        }

        // 通过 DataSourceManager 执行真实 JDBC 连接测试（不缓存连接池）
        DataSourceManager.TestResult result = dataSourceManager.testConnection(sourceType, connConfig);

        return TestConnectionResponse.builder()
                .success(result.success())
                .message(result.message())
                .datasourceId(request.getDatasourceId())
                .sourceType(sourceType)
                .latencyMs(result.latencyMs())
                .testedAt(OffsetDateTime.now())
                .build();
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private DataSourceEntity requireDataSource(String id) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return dataSourceRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> DataException.datasourceNotFound(id));
    }

    private void validateSourceType(String sourceType) {
        if (sourceType == null || sourceType.isBlank()) {
            throw DataException.invalidParam("sourceType 不能为空");
        }
        if (!SUPPORTED_SOURCE_TYPES.contains(sourceType.toLowerCase())) {
            throw DataException.unsupportedSourceType(sourceType);
        }
    }

    private void validateStatus(String status) {
        if (status != null && !ALLOWED_STATUS.contains(status)) {
            throw DataException.invalidParam("非法状态: " + status);
        }
    }

    /**
     * 加密 connectionConfig 中的密码字段。
     */
    private String encryptConnectionConfig(Map<String, Object> config) {
        try {
            ObjectNode node = objectMapper.valueToTree(config);
            if (node.has("password") && !node.get("password").isNull()) {
                String plain = node.get("password").asText();
                node.put("password", CryptoUtil.encrypt(plain, dataProperties.getDataEncryptionKey()));
                node.put("passwordEncrypted", true);
            }
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new DataException(ErrorCode.INVALID_PARAM, "connectionConfig 序列化失败: " + e.getMessage(), e);
        }
    }

    /**
     * 解密 connectionConfig（仅 Service 内部使用，不外泄）。
     */
    private Map<String, Object> decryptToMap(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            ObjectNode mutable = node.deepCopy();
            if (mutable.has("password") && mutable.has("passwordEncrypted")
                    && mutable.get("passwordEncrypted").asBoolean()) {
                String cipher = mutable.get("password").asText();
                mutable.put("password", CryptoUtil.decrypt(cipher, dataProperties.getDataEncryptionKey()));
            }
            return objectMapper.convertValue(mutable, new com.fasterxml.jackson.core.type.TypeReference<>() {});
        } catch (Exception e) {
            throw new DataException(ErrorCode.INTERNAL_ERROR, "connectionConfig 解析失败: " + e.getMessage(), e);
        }
    }

    /**
     * 转换为响应 DTO（脱敏：移除 password 字段）。
     */
    private DataSourceResponse toResponse(DataSourceEntity entity) {
        JsonNode safeConfig;
        try {
            JsonNode node = objectMapper.readTree(entity.getConnectionConfig());
            ObjectNode mutable = node.deepCopy();
            if (mutable.has("password")) {
                mutable.remove("password");
            }
            if (mutable.has("passwordEncrypted")) {
                mutable.remove("passwordEncrypted");
            }
            safeConfig = mutable;
        } catch (JsonProcessingException e) {
            safeConfig = objectMapper.createObjectNode();
        }
        return DataSourceResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .sourceType(entity.getSourceType())
                .connectionConfig(safeConfig)
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private static String newDataSourceId() {
        return "ds-" + UUID.randomUUID().toString().replace("-", "");
    }
}
