package com.metaplatform.data.dbt;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.dbt.dto.CreateDbtProjectRequest;
import com.metaplatform.data.dbt.dto.DbtDagResponse;
import com.metaplatform.data.dbt.dto.DbtModelResponse;
import com.metaplatform.data.dbt.dto.DbtProjectResponse;
import com.metaplatform.data.dbt.dto.DbtRunResponse;
import com.metaplatform.data.dbt.dto.UpdateDbtProjectRequest;
import com.metaplatform.data.entity.DbtModelEntity;
import com.metaplatform.data.entity.DbtProjectEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.repository.DbtModelRepository;
import com.metaplatform.data.repository.DbtProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * dbt 项目服务：项目 CRUD + compile/run + DAG + models。
 *
 * <p>对应 Python app/dbt/service.py 的 DbtService。</p>
 *
 * <p>持久化存储（dbt_project / dbt_model 表）；compile/run 保持 stub 但更新 lastRunAt/lastRunStatus。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DbtService {

    private final ObjectMapper objectMapper;
    private final DbtProjectRepository dbtProjectRepository;
    private final DbtModelRepository dbtModelRepository;

    /**
     * 创建 dbt 项目。
     */
    @Transactional
    public DbtProjectResponse create(CreateDbtProjectRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        if (dbtProjectRepository.existsByTenantIdAndName(tenantId, request.getName())) {
            throw new DataException(ErrorCode.DBT_PROJECT_DUPLICATE, "DBT 项目已存在: " + request.getName());
        }
        String projectId = "dbt-" + UUID.randomUUID().toString().replace("-", "");
        DbtProjectEntity entity = new DbtProjectEntity();
        entity.setId(projectId);
        entity.setTenantId(tenantId);
        entity.setName(request.getName());
        entity.setDescription(request.getDescription());
        entity.setTargetDsId(request.getTargetDatasourceId());
        entity.setProjectPath(request.getProjectDir() != null ? request.getProjectDir() : "");
        entity.setProfilesPath(request.getProfilesYml());
        entity.setStatus("DRAFT");

        DbtProjectEntity saved = dbtProjectRepository.save(entity);
        log.info("dbt 项目创建 | tenant={} id={} name={}", tenantId, projectId, request.getName());
        return toResponse(saved);
    }

    /**
     * 项目列表。
     */
    @Transactional(readOnly = true)
    public PageResponse<DbtProjectResponse> list(int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<DbtProjectEntity> result = dbtProjectRepository.findByTenantId(tenantId, pageable);
        return PageResponse.of(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    @Transactional(readOnly = true)
    public DbtProjectResponse get(String projectId) {
        return toResponse(requireProject(projectId));
    }

    @Transactional
    public DbtProjectResponse update(String projectId, UpdateDbtProjectRequest request) {
        DbtProjectEntity entity = requireProject(projectId);
        if (request.getName() != null) entity.setName(request.getName());
        if (request.getProjectDir() != null) entity.setProjectPath(request.getProjectDir());
        if (request.getProfilesYml() != null) entity.setProfilesPath(request.getProfilesYml());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getStatus() != null) entity.setStatus(request.getStatus());
        DbtProjectEntity saved = dbtProjectRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public boolean delete(String projectId) {
        DbtProjectEntity entity = requireProject(projectId);
        String tenantId = TenantContext.getTenantIdOrDefault();
        // 删除关联模型
        List<DbtModelEntity> models = dbtModelRepository
                .findByTenantIdAndProjectId(tenantId, projectId, PageRequest.of(0, Integer.MAX_VALUE))
                .getContent();
        if (!models.isEmpty()) {
            dbtModelRepository.deleteAll(models);
        }
        dbtProjectRepository.delete(entity);
        return true;
    }

    /**
     * 编译项目（stub：更新 lastRunAt/lastRunStatus）。
     */
    @Transactional
    public DbtRunResponse compile(String projectId) {
        DbtProjectEntity entity = requireProject(projectId);
        entity.setLastRunAt(OffsetDateTime.now());
        entity.setLastRunStatus("SUCCESS");
        dbtProjectRepository.save(entity);
        return buildRun(projectId, "compile");
    }

    /**
     * 运行项目（stub：更新 lastRunAt/lastRunStatus）。
     */
    @Transactional
    public DbtRunResponse run(String projectId) {
        DbtProjectEntity entity = requireProject(projectId);
        entity.setLastRunAt(OffsetDateTime.now());
        entity.setLastRunStatus("SUCCESS");
        dbtProjectRepository.save(entity);
        return buildRun(projectId, "run");
    }

    /**
     * 获取项目 DAG（从 DbtModelRepository depends_on 字段构建）。
     */
    @Transactional(readOnly = true)
    public DbtDagResponse getDag(String projectId) {
        requireProject(projectId);
        String tenantId = TenantContext.getTenantIdOrDefault();
        List<DbtModelEntity> models = dbtModelRepository
                .findByTenantIdAndProjectId(tenantId, projectId, PageRequest.of(0, Integer.MAX_VALUE))
                .getContent();

        List<DbtDagResponse.DagNode> nodes = new ArrayList<>();
        List<DbtDagResponse.DagEdge> edges = new ArrayList<>();

        for (DbtModelEntity model : models) {
            nodes.add(DbtDagResponse.DagNode.builder()
                    .id(model.getName())
                    .name(model.getName())
                    .resourceType("model")
                    .materialized(model.getMaterialization())
                    .build());
            List<String> deps = parseDependsOn(model.getDependsOn());
            for (String dep : deps) {
                edges.add(DbtDagResponse.DagEdge.builder().source(dep).target(model.getName()).build());
            }
        }

        return DbtDagResponse.builder().projectId(projectId).nodes(nodes).edges(edges).build();
    }

    /**
     * 列出项目模型。
     */
    @Transactional(readOnly = true)
    public List<DbtModelResponse> listModels(String projectId) {
        requireProject(projectId);
        String tenantId = TenantContext.getTenantIdOrDefault();
        List<DbtModelEntity> models = dbtModelRepository
                .findByTenantIdAndProjectId(tenantId, projectId, PageRequest.of(0, Integer.MAX_VALUE))
                .getContent();
        return models.stream().map(this::toModelResponse).toList();
    }

    /**
     * 历史运行记录（stub：无历史运行实体，返回空页）。
     */
    @Transactional(readOnly = true)
    public PageResponse<DbtRunResponse> runs(String projectId, int page, int pageSize) {
        requireProject(projectId);
        return PageResponse.empty(page, pageSize);
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private DbtProjectEntity requireProject(String projectId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return dbtProjectRepository.findByIdAndTenantId(projectId, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.DBT_PROJECT_NOT_FOUND, "DBT 项目不存在: " + projectId));
    }

    private DbtRunResponse buildRun(String projectId, String command) {
        OffsetDateTime now = OffsetDateTime.now();
        return DbtRunResponse.builder()
                .runId("dbt-run-" + UUID.randomUUID().toString().replace("-", ""))
                .projectId(projectId)
                .command(command)
                .status("SUCCESS")
                .modelsCompiled(List.of("stg_orders", "dim_customers", "fct_orders"))
                .modelsRun(command.equals("run") ? List.of("dim_customers", "fct_orders") : List.of())
                .totalModels(3)
                .successModels(3)
                .failedModels(0)
                .latencyMs(0L)
                .log("dbt " + command + " completed (stub)")
                .startedAt(now)
                .finishedAt(now)
                .build();
    }

    private DbtProjectResponse toResponse(DbtProjectEntity entity) {
        return DbtProjectResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .targetDatasourceId(entity.getTargetDsId())
                .projectDir(entity.getProjectPath())
                .profilesYml(entity.getProfilesPath())
                .config(objectMapper.createObjectNode())
                .status(entity.getStatus())
                .description(entity.getDescription())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private DbtModelResponse toModelResponse(DbtModelEntity entity) {
        return DbtModelResponse.builder()
                .modelId(entity.getId())
                .projectId(entity.getProjectId())
                .name(entity.getName())
                .resourceType("model")
                .materialized(entity.getMaterialization())
                .schema(null)
                .alias(null)
                .sql(entity.getSqlContent())
                .description(entity.getDescription())
                .status(entity.getStatus())
                .build();
    }

    private List<String> parseDependsOn(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
