package com.metaplatform.data.etl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.entity.EtlTaskEntity;
import com.metaplatform.data.entity.EtlTaskRunEntity;
import com.metaplatform.data.etl.dto.CreateEtlTaskRequest;
import com.metaplatform.data.etl.dto.EtlRunResponse;
import com.metaplatform.data.etl.dto.EtlTaskResponse;
import com.metaplatform.data.etl.dto.UpdateEtlTaskRequest;
import com.metaplatform.data.etl.support.FlinkJobClient;
import com.metaplatform.data.etl.support.SpringBatchFallbackExecutor;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.repository.EtlTaskRepository;
import com.metaplatform.data.repository.EtlTaskRunRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * ETL 任务服务：任务 CRUD + 触发执行 + 运行历史。
 *
 * <p>基于 JPA Repository 持久化，执行引擎支持 Flink REST + Spring Batch 降级。</p>
 *
 * <p>引擎路由策略：
 * <ul>
 *   <li>FLINK：调用 FlinkJobClient.submitJob，失败则降级到 SpringBatchFallbackExecutor</li>
 *   <li>SPRING_BATCH：直接调用 SpringBatchFallbackExecutor.executeAsync</li>
 *   <li>AIRFLOW/DBT：暂未实现，抛出 DataException</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EtlTaskService {

    private static final String STATUS_DRAFT = "DRAFT";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String RUN_STATUS_QUEUED = "QUEUED";
    private static final String RUN_STATUS_RUNNING = "RUNNING";
    private static final String RUN_STATUS_CANCELLED = "CANCELLED";

    private static final String ENGINE_FLINK = "FLINK";
    private static final String ENGINE_SPRING_BATCH = "SPRING_BATCH";
    private static final String ENGINE_AIRFLOW = "AIRFLOW";
    private static final String ENGINE_DBT = "DBT";

    private final EtlTaskRepository etlTaskRepository;
    private final EtlTaskRunRepository etlTaskRunRepository;
    private final FlinkJobClient flinkJobClient;
    private final SpringBatchFallbackExecutor springBatchFallbackExecutor;
    private final ObjectMapper objectMapper;

    // =====================================================================
    // 任务 CRUD
    // =====================================================================

    @Transactional
    public EtlTaskResponse create(CreateEtlTaskRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        String createdBy = TenantContext.getUserId() != null ? TenantContext.getUserId() : "system";

        // 构建配置 JSON：将 sourceTable / transformConfig 等存入 config
        ObjectNode configNode = objectMapper.createObjectNode();
        if (request.getSourceTable() != null) {
            configNode.put("sourceTable", request.getSourceTable());
        }
        if (request.getTransformConfig() != null) {
            configNode.set("transformConfig", objectMapper.valueToTree(request.getTransformConfig()));
        }
        configNode.put("transformType", "FULL");

        EtlTaskEntity entity = EtlTaskEntity.builder()
                .id("etl-" + UUID.randomUUID().toString().replace("-", ""))
                .tenantId(tenantId)
                .name(request.getName())
                .description(request.getDescription())
                .sourceDsId(request.getSourceDatasourceId())
                .targetDsId(request.getTargetDatasourceId())
                .targetTable(request.getTargetTable())
                .engine(request.getType())
                .config(configNode.toString())
                .scheduleCron(request.getSchedule())
                .status(STATUS_DRAFT)
                .createdBy(createdBy)
                .rowsProcessed(0L)
                .build();

        EtlTaskEntity saved = etlTaskRepository.save(entity);
        log.info("ETL 任务创建 | tenant={} id={} name={} engine={}", tenantId, saved.getId(), saved.getName(), saved.getEngine());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<EtlTaskResponse> list(String status, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<EtlTaskEntity> result;
        if (status != null && !status.isBlank()) {
            result = etlTaskRepository.findByTenantIdAndStatus(tenantId, status, pageable);
        } else {
            result = etlTaskRepository.findByTenantId(tenantId, pageable);
        }

        return PageResponse.of(result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    @Transactional(readOnly = true)
    public EtlTaskResponse get(String taskId) {
        return toResponse(requireTask(taskId));
    }

    @Transactional
    public EtlTaskResponse update(String taskId, UpdateEtlTaskRequest request) {
        EtlTaskEntity entity = requireTask(taskId);
        if (request.getName() != null) entity.setName(request.getName());
        if (request.getTransformConfig() != null) {
            ObjectNode configNode = parseConfig(entity.getConfig());
            configNode.set("transformConfig", objectMapper.valueToTree(request.getTransformConfig()));
            entity.setConfig(configNode.toString());
        }
        if (request.getSchedule() != null) entity.setScheduleCron(request.getSchedule());
        if (request.getStatus() != null) entity.setStatus(request.getStatus());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());

        EtlTaskEntity saved = etlTaskRepository.save(entity);
        log.info("ETL 任务更新 | id={}", taskId);
        return toResponse(saved);
    }

    @Transactional
    public boolean delete(String taskId) {
        EtlTaskEntity entity = requireTask(taskId);
        etlTaskRepository.delete(entity);
        log.info("ETL 任务删除 | id={}", taskId);
        return true;
    }

    // =====================================================================
    // 任务执行
    // =====================================================================

    /**
     * 触发任务执行。
     *
     * <p>创建运行记录（QUEUED），根据 task.engine 路由到对应执行引擎，
     * 异步执行完成后自动更新运行状态与任务统计。</p>
     */
    @Transactional
    public EtlRunResponse trigger(String taskId) {
        EtlTaskEntity task = requireTask(taskId);
        String tenantId = task.getTenantId();
        String triggeredBy = TenantContext.getUserId() != null ? TenantContext.getUserId() : "system";

        // 1. 创建运行记录
        EtlTaskRunEntity run = new EtlTaskRunEntity();
        run.setId("run-" + UUID.randomUUID().toString().replace("-", ""));
        run.setTenantId(tenantId);
        run.setTaskId(taskId);
        run.setStatus(RUN_STATUS_QUEUED);
        run.setTriggeredBy(triggeredBy);
        run.setStartedAt(OffsetDateTime.now());
        run.setRowsRead(0L);
        run.setRowsWritten(0L);
        run = etlTaskRunRepository.save(run);

        // 2. 根据引擎路由
        String engine = task.getEngine() != null ? task.getEngine().toUpperCase() : ENGINE_SPRING_BATCH;
        try {
            switch (engine) {
                case ENGINE_FLINK -> triggerFlink(task, run);
                case ENGINE_SPRING_BATCH -> triggerSpringBatch(task, run);
                case ENGINE_AIRFLOW, ENGINE_DBT -> throw new DataException(ErrorCode.ETL_EXECUTION_FAILED,
                        "暂未实现 " + engine + " 引擎，请使用 SPRING_BATCH 或 FLINK");
                default -> {
                    log.warn("未知引擎 {}，降级到 SPRING_BATCH | task={}", engine, taskId);
                    triggerSpringBatch(task, run);
                }
            }
        } catch (DataException e) {
            throw e;
        } catch (Exception e) {
            log.error("ETL 触发失败 | task={} engine={} error={}", taskId, engine, e.getMessage(), e);
            throw new DataException(ErrorCode.ETL_EXECUTION_FAILED,
                    "ETL 触发失败: " + e.getMessage(), e);
        }

        // 3. 更新任务最近运行信息（初始状态）
        task.setLastRunId(run.getId());
        task.setLastRunAt(run.getStartedAt());
        task.setLastRunStatus(run.getStatus());
        etlTaskRepository.save(task);

        log.info("ETL 任务触发 | task={} run={} engine={} status={}", taskId, run.getId(), engine, run.getStatus());
        return toRunResponse(run);
    }

    /**
     * Flink 引擎执行：提交作业 + 异步轮询状态。
     * 失败（IllegalStateException）时降级到 SpringBatchFallbackExecutor。
     */
    private void triggerFlink(EtlTaskEntity task, EtlTaskRunEntity run) {
        try {
            String flinkJobId = flinkJobClient.submitJob(task);
            // 提交成功，记录 flinkJobId 并更新状态
            run.setStatus(RUN_STATUS_RUNNING);
            run.setExecutionLog("flinkJobId=" + flinkJobId);
            etlTaskRunRepository.save(run);

            // 异步轮询 Flink 作业状态
            flinkJobClient.pollJobUntilDone(task, run, flinkJobId);
            log.info("Flink 作业已提交并启动轮询 | task={} run={} flinkJobId={}", task.getId(), run.getId(), flinkJobId);
        } catch (IllegalStateException e) {
            // Flink 不可用，降级到 Spring Batch
            log.warn("Flink 不可用，降级到 Spring Batch 执行 | task={} reason={}", task.getId(), e.getMessage());
            run.setStatus(RUN_STATUS_QUEUED);
            run.setExecutionLog("Flink 降级到 SpringBatch: " + e.getMessage());
            etlTaskRunRepository.save(run);
            springBatchFallbackExecutor.executeAsync(task, run);
        }
    }

    /**
     * Spring Batch 引擎执行：直接调用降级执行器异步执行。
     */
    private void triggerSpringBatch(EtlTaskEntity task, EtlTaskRunEntity run) {
        springBatchFallbackExecutor.executeAsync(task, run);
    }

    // =====================================================================
    // 运行历史
    // =====================================================================

    @Transactional(readOnly = true)
    public PageResponse<EtlRunResponse> runs(String taskId, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        // 校验任务存在
        requireTask(taskId);

        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "startedAt"));
        Page<EtlTaskRunEntity> result = etlTaskRunRepository
                .findByTenantIdAndTaskIdOrderByStartedAtDesc(tenantId, taskId, pageable);

        return PageResponse.of(result.getContent().stream().map(this::toRunResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    /**
     * 取消运行。
     *
     * <p>SPRING_BATCH：标记为 CANCELLED（JVM 内中断）。</p>
     * <p>FLINK：调用 FlinkJobClient.cancelJob。</p>
     */
    @Transactional
    public EtlRunResponse cancelRun(String taskId, String runId) {
        EtlTaskRunEntity run = requireRun(taskId, runId);
        EtlTaskEntity task = requireTask(taskId);

        String engine = task.getEngine() != null ? task.getEngine().toUpperCase() : ENGINE_SPRING_BATCH;
        if (ENGINE_FLINK.equals(engine) && run.getExecutionLog() != null) {
            // 从 executionLog 中解析 flinkJobId
            String flinkJobId = extractFlinkJobId(run.getExecutionLog());
            if (flinkJobId != null) {
                try {
                    flinkJobClient.cancelJob(flinkJobId);
                } catch (Exception e) {
                    log.warn("Flink 取消失败，强制标记 CANCELLED | run={} error={}", runId, e.getMessage());
                }
            }
        }

        run.setStatus(RUN_STATUS_CANCELLED);
        run.setFinishedAt(OffsetDateTime.now());
        etlTaskRunRepository.save(run);

        task.setLastRunStatus(RUN_STATUS_CANCELLED);
        etlTaskRepository.save(task);

        log.info("ETL 运行取消 | task={} run={}", taskId, runId);
        return toRunResponse(run);
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private EtlTaskEntity requireTask(String taskId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return etlTaskRepository.findByIdAndTenantId(taskId, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.QUERY_NOT_FOUND, "ETL 任务不存在: " + taskId));
    }

    private EtlTaskRunEntity requireRun(String taskId, String runId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        EtlTaskRunEntity run = etlTaskRunRepository.findByIdAndTenantId(runId, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.QUERY_NOT_FOUND, "ETL 运行记录不存在: " + runId));
        if (!taskId.equals(run.getTaskId())) {
            throw new DataException(ErrorCode.QUERY_NOT_FOUND, "运行记录不属于任务: " + taskId + " / " + runId);
        }
        return run;
    }

    private String extractFlinkJobId(String executionLog) {
        if (executionLog == null || !executionLog.contains("flinkJobId=")) {
            return null;
        }
        String prefix = "flinkJobId=";
        int start = executionLog.indexOf(prefix) + prefix.length();
        int end = executionLog.indexOf(",", start);
        if (end == -1) end = executionLog.length();
        return executionLog.substring(start, end).trim();
    }

    private ObjectNode parseConfig(String configJson) {
        if (configJson == null || configJson.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            return (ObjectNode) objectMapper.readTree(configJson);
        } catch (Exception e) {
            log.warn("解析 config JSON 失败，返回空节点 | error={}", e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    private EtlTaskResponse toResponse(EtlTaskEntity entity) {
        JsonNode configNode = parseConfig(entity.getConfig());
        String sourceTable = configNode.has("sourceTable") ? configNode.get("sourceTable").asText() : null;
        JsonNode transformConfig = configNode.has("transformConfig") ? configNode.get("transformConfig") : null;

        return EtlTaskResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .type(entity.getEngine())
                .sourceDatasourceId(entity.getSourceDsId())
                .targetDatasourceId(entity.getTargetDsId())
                .sourceTable(sourceTable)
                .targetTable(entity.getTargetTable())
                .transformConfig(transformConfig != null ? transformConfig : objectMapper.createObjectNode())
                .schedule(entity.getScheduleCron())
                .status(entity.getStatus())
                .description(entity.getDescription())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private EtlRunResponse toRunResponse(EtlTaskRunEntity entity) {
        long latencyMs = 0;
        if (entity.getStartedAt() != null && entity.getFinishedAt() != null) {
            latencyMs = java.time.Duration.between(entity.getStartedAt(), entity.getFinishedAt()).toMillis();
        }
        return EtlRunResponse.builder()
                .runId(entity.getId())
                .taskId(entity.getTaskId())
                .status(entity.getStatus())
                .rowsProcessed(entity.getRowsWritten() != null ? entity.getRowsWritten() : 0)
                .bytesProcessed(0)
                .latencyMs(latencyMs)
                .errorMessage(entity.getErrorMessage())
                .triggeredBy(entity.getTriggeredBy())
                .startedAt(entity.getStartedAt())
                .finishedAt(entity.getFinishedAt())
                .build();
    }
}
