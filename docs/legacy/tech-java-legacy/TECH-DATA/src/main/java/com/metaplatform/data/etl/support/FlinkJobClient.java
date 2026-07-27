package com.metaplatform.data.etl.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.config.FlinkProperties;
import com.metaplatform.data.entity.EtlTaskEntity;
import com.metaplatform.data.entity.EtlTaskRunEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.repository.EtlTaskRepository;
import com.metaplatform.data.repository.EtlTaskRunRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Set;

/**
 * Flink REST API 客户端：通过 WebClient 调用 Flink JobManager REST API。
 *
 * <p>不引入 flink-java 依赖，仅使用 Spring WebClient 调用 REST 端点：
 * <ul>
 *   <li>{@code GET /jobs/overview} — 列出所有 Job 概览</li>
 *   <li>{@code GET /jobs/{jobId}} — 获取 Job 详情</li>
 *   <li>{@code POST /jars/{jarId}/run} — 提交 JAR 运行</li>
 *   <li>{@code PATCH /jobs/{jobId}} — 取消 Job</li>
 * </ul>
 *
 * <p>当 {@code FlinkProperties.enabled=false} 或 Flink REST 不可达时，
 * {@link #submitJob} 抛出 {@link IllegalStateException} 触发降级到
 * {@link SpringBatchFallbackExecutor}。</p>
 */
@Slf4j
@Component
public class FlinkJobClient {

    private static final Set<String> TERMINAL_STATES = Set.of(
            "FINISHED", "FAILED", "CANCELED", "NOT_FOUND");

    private final FlinkProperties flinkProperties;
    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final EtlTaskRunRepository etlTaskRunRepository;
    private final EtlTaskRepository etlTaskRepository;

    public FlinkJobClient(FlinkProperties flinkProperties,
                          WebClient webClient,
                          ObjectMapper objectMapper,
                          EtlTaskRunRepository etlTaskRunRepository,
                          EtlTaskRepository etlTaskRepository) {
        this.flinkProperties = flinkProperties;
        this.webClient = webClient;
        this.objectMapper = objectMapper;
        this.etlTaskRunRepository = etlTaskRunRepository;
        this.etlTaskRepository = etlTaskRepository;
    }

    /**
     * 检测 Flink REST API 是否可达。
     *
     * <p>当 {@code enabled=false} 时直接返回 false，不发起请求。</p>
     */
    public boolean isAvailable() {
        if (!flinkProperties.isEnabled()) {
            log.debug("Flink 引擎未启用（mate.flink.enabled=false）");
            return false;
        }
        try {
            webClient.get()
                    .uri(flinkProperties.getRestUrl() + "/config")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(Duration.ofMillis(flinkProperties.getSubmitTimeoutMs()));
            log.debug("Flink REST 可达 | url={}", flinkProperties.getRestUrl());
            return true;
        } catch (Exception e) {
            log.warn("Flink REST 不可达 | url={} error={}", flinkProperties.getRestUrl(), e.getMessage());
            return false;
        }
    }

    /**
     * 提交 ETL 作业到 Flink 集群。
     *
     * <p>简化实现：从 EtlTaskEntity.config 中解析 jarId / entryClass / args，
     * 调用 {@code POST /jars/{jarId}/run}。</p>
     *
     * @param task ETL 任务实体
     * @return Flink jobId
     * @throws IllegalStateException 当 Flink 未启用或不可达时
     * @throws DataException         当 Flink REST 调用失败时
     */
    public String submitJob(EtlTaskEntity task) {
        if (!isAvailable()) {
            throw new IllegalStateException("Flink REST 不可用，触发降级执行");
        }

        String jarId = extractConfigValue(task.getConfig(), "jarId");
        String entryClass = extractConfigValue(task.getConfig(), "entryClass");
        String programArgs = extractConfigValue(task.getConfig(), "programArgs");

        if (jarId == null || jarId.isBlank()) {
            throw new IllegalStateException("Flink 任务缺少 jarId 配置，触发降级执行");
        }

        try {
            Map<String, Object> requestBody = new java.util.HashMap<>();
            if (entryClass != null && !entryClass.isBlank()) {
                requestBody.put("entryClass", entryClass);
            }
            if (programArgs != null && !programArgs.isBlank()) {
                requestBody.put("programArgs", programArgs);
            }
            // parallelism 可从 config 中读取
            String parallelismStr = extractConfigValue(task.getConfig(), "parallelism");
            if (parallelismStr != null && !parallelismStr.isBlank()) {
                requestBody.put("parallelism", Integer.parseInt(parallelismStr));
            }

            String response = webClient.post()
                    .uri(flinkProperties.getRestUrl() + "/jars/" + jarId + "/run")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(Duration.ofMillis(flinkProperties.getSubmitTimeoutMs()));

            String flinkJobId = parseJobId(response);
            log.info("Flink 作业提交成功 | task={} flinkJobId={} jarId={}", task.getId(), flinkJobId, jarId);
            return flinkJobId;
        } catch (IllegalStateException e) {
            throw e; // 降级信号
        } catch (Exception e) {
            log.error("Flink 作业提交失败 | task={} error={}", task.getId(), e.getMessage());
            throw new DataException(ErrorCode.FLINK_JOB_FAILED,
                    "Flink 作业提交失败: " + e.getMessage(), e);
        }
    }

    /**
     * 查询 Flink Job 状态。
     *
     * @return 状态字符串（INITIALIZING / RUNNING / FAILING / CANCELED / FINISHED / FAILED / RESTARTING）
     */
    public String getJobStatus(String flinkJobId) {
        try {
            String response = webClient.get()
                    .uri(flinkProperties.getRestUrl() + "/jobs/" + flinkJobId)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(Duration.ofMillis(flinkProperties.getSubmitTimeoutMs()));

            JsonNode node = objectMapper.readTree(response);
            if (node.has("state")) {
                return node.get("state").asText();
            }
            return "UNKNOWN";
        } catch (WebClientResponseException.NotFound e) {
            log.warn("Flink Job 不存在 | flinkJobId={}", flinkJobId);
            return "NOT_FOUND";
        } catch (Exception e) {
            log.error("查询 Flink Job 状态失败 | flinkJobId={} error={}", flinkJobId, e.getMessage());
            throw new DataException(ErrorCode.FLINK_JOB_FAILED,
                    "查询 Flink Job 状态失败: " + e.getMessage(), e);
        }
    }

    /**
     * 取消 Flink Job。
     */
    public void cancelJob(String flinkJobId) {
        try {
            webClient.patch()
                    .uri(flinkProperties.getRestUrl() + "/jobs/" + flinkJobId)
                    .bodyValue(Map.of("mode", "cancel"))
                    .retrieve()
                    .bodyToMono(Void.class)
                    .block(Duration.ofMillis(flinkProperties.getSubmitTimeoutMs()));
            log.info("Flink 作业取消成功 | flinkJobId={}", flinkJobId);
        } catch (Exception e) {
            log.error("Flink 作业取消失败 | flinkJobId={} error={}", flinkJobId, e.getMessage());
            throw new DataException(ErrorCode.FLINK_JOB_FAILED,
                    "Flink 作业取消失败: " + e.getMessage(), e);
        }
    }

    /**
     * 异步轮询 Flink Job 状态，直到到达终态后更新 EtlTaskRunEntity 和 EtlTaskEntity。
     *
     * <p>终态映射：FINISHED → SUCCESS，FAILED/CANCELED/NOT_FOUND → FAILED。</p>
     *
     * @param task       ETL 任务实体
     * @param run        运行记录实体（status=RUNNING）
     * @param flinkJobId Flink Job ID
     */
    @Async
    public void pollJobUntilDone(EtlTaskEntity task, EtlTaskRunEntity run, String flinkJobId) {
        log.info("开始轮询 Flink 作业状态 | task={} run={} flinkJobId={}", task.getId(), run.getId(), flinkJobId);
        try {
            while (true) {
                String state = getJobStatus(flinkJobId);
                if (TERMINAL_STATES.contains(state)) {
                    OffsetDateTime now = OffsetDateTime.now();
                    run.setFinishedAt(now);

                    if ("FINISHED".equals(state)) {
                        run.setStatus("SUCCESS");
                    } else {
                        run.setStatus("FAILED");
                        run.setErrorMessage("Flink 作业终态: " + state);
                    }
                    etlTaskRunRepository.save(run);

                    task.setLastRunId(run.getId());
                    task.setLastRunAt(now);
                    task.setLastRunStatus(run.getStatus());
                    task.setRowsProcessed(run.getRowsWritten());
                    etlTaskRepository.save(task);

                    log.info("Flink 作业终态 | task={} run={} state={}", task.getId(), run.getId(), state);
                    break;
                }
                Thread.sleep(flinkProperties.getPollIntervalMs());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Flink 作业轮询被中断 | task={} run={}", task.getId(), run.getId());
            run.setStatus("FAILED");
            run.setErrorMessage("轮询被中断");
            run.setFinishedAt(OffsetDateTime.now());
            etlTaskRunRepository.save(run);
        } catch (Exception e) {
            log.error("Flink 作业轮询异常 | task={} run={} error={}", task.getId(), run.getId(), e.getMessage(), e);
            run.setStatus("FAILED");
            run.setErrorMessage("轮询异常: " + e.getMessage());
            run.setFinishedAt(OffsetDateTime.now());
            etlTaskRunRepository.save(run);

            task.setLastRunId(run.getId());
            task.setLastRunAt(run.getFinishedAt());
            task.setLastRunStatus("FAILED");
            etlTaskRepository.save(task);
        }
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private String parseJobId(String response) {
        try {
            JsonNode node = objectMapper.readTree(response);
            if (node.has("jobid")) {
                return node.get("jobid").asText();
            }
            throw new DataException(ErrorCode.FLINK_JOB_FAILED,
                    "Flink REST 响应缺少 jobid 字段: " + response);
        } catch (DataException e) {
            throw e;
        } catch (Exception e) {
            throw new DataException(ErrorCode.FLINK_JOB_FAILED,
                    "解析 Flink REST 响应失败: " + e.getMessage(), e);
        }
    }

    /**
     * 从 EtlTaskEntity.config（JSON 字符串）中提取字段值。
     */
    private String extractConfigValue(String configJson, String key) {
        if (configJson == null || configJson.isBlank()) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(configJson);
            JsonNode value = node.get(key);
            return value != null && !value.isNull() ? value.asText() : null;
        } catch (Exception e) {
            log.warn("解析 ETL config JSON 失败 | key={} error={}", key, e.getMessage());
            return null;
        }
    }
}
