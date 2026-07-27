package com.metaplatform.data.etl.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.data.datasources.support.DataSourceManager;
import com.metaplatform.data.entity.EtlTaskEntity;
import com.metaplatform.data.entity.EtlTaskRunEntity;
import com.metaplatform.data.repository.EtlTaskRepository;
import com.metaplatform.data.repository.EtlTaskRunRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Spring Batch 降级执行器：当 Flink 不可用时，在 JVM 内通过 JdbcTemplate 执行 ETL。
 *
 * <p>简化实现：仅支持 {@code SELECT * FROM <source_table>} → {@code INSERT INTO <target_table>}
 * 的全量搬运模式。CDC / 增量同步等复杂转换抛出 {@link UnsupportedOperationException}。</p>
 *
 * <p>异步执行由 {@link Async} 注解驱动，调用方（EtlTaskService）创建 EtlTaskRunEntity 后
 * 调用 {@link #executeAsync}，本方法在独立线程中完成数据搬运并更新运行状态。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SpringBatchFallbackExecutor {

    private static final String RUN_STATUS_RUNNING = "RUNNING";
    private static final String RUN_STATUS_SUCCESS = "SUCCESS";
    private static final String RUN_STATUS_FAILED = "FAILED";
    private static final String TASK_STATUS_ACTIVE = "ACTIVE";

    private final DataSourceManager dataSourceManager;
    private final EtlTaskRunRepository etlTaskRunRepository;
    private final EtlTaskRepository etlTaskRepository;
    private final ObjectMapper objectMapper;

    /**
     * 异步执行 ETL 数据搬运。
     *
     * <p>由 EtlTaskService.trigger() 在创建 EtlTaskRunEntity 后调用。
     * 本方法在独立线程中完成以下步骤：
     * <ol>
     *   <li>更新 run.status=RUNNING</li>
     *   <li>从 sourceDsId 抽取数据，写入 targetDsId</li>
     *   <li>更新 run.status=SUCCESS/FAILED + rowsRead/rowsWritten + finishedAt</li>
     *   <li>更新 task.lastRunId/lastRunAt/lastRunStatus/rowsProcessed</li>
     * </ol>
     *
     * @param task ETL 任务实体
     * @param run  运行记录实体（已由调用方创建，status=QUEUED）
     */
    @Async
    public void executeAsync(EtlTaskEntity task, EtlTaskRunEntity run) {
        try {
            run.setStatus(RUN_STATUS_RUNNING);
            run.setStartedAt(OffsetDateTime.now());
            etlTaskRunRepository.save(run);
            log.info("ETL 降级执行开始 | task={} run={}", task.getId(), run.getId());

            long[] counts = doJdbcCopy(task);

            run.setStatus(RUN_STATUS_SUCCESS);
            run.setRowsRead(counts[0]);
            run.setRowsWritten(counts[1]);
            run.setFinishedAt(OffsetDateTime.now());
            etlTaskRunRepository.save(run);

            task.setLastRunId(run.getId());
            task.setLastRunAt(run.getFinishedAt());
            task.setLastRunStatus(RUN_STATUS_SUCCESS);
            task.setRowsProcessed(counts[1]);
            task.setStatus(TASK_STATUS_ACTIVE);
            etlTaskRepository.save(task);

            log.info("ETL 降级执行完成 | task={} run={} rowsRead={} rowsWritten={}",
                    task.getId(), run.getId(), counts[0], counts[1]);
        } catch (Exception e) {
            log.error("ETL 降级执行失败 | task={} run={} error={}", task.getId(), run.getId(), e.getMessage(), e);
            run.setStatus(RUN_STATUS_FAILED);
            run.setErrorMessage(e.getMessage());
            run.setFinishedAt(OffsetDateTime.now());
            etlTaskRunRepository.save(run);

            task.setLastRunId(run.getId());
            task.setLastRunAt(run.getFinishedAt());
            task.setLastRunStatus(RUN_STATUS_FAILED);
            etlTaskRepository.save(task);
        }
    }

    /**
     * 同步执行 ETL（供测试或直接调用使用）。
     *
     * <p>创建新的 EtlTaskRunEntity，执行数据搬运，返回 runId。</p>
     *
     * @param task ETL 任务实体
     * @return 运行记录 ID
     */
    public String execute(EtlTaskEntity task) {
        EtlTaskRunEntity run = new EtlTaskRunEntity();
        run.setId("run-" + UUID.randomUUID().toString().replace("-", ""));
        run.setTenantId(task.getTenantId());
        run.setTaskId(task.getId());
        run.setStatus(RUN_STATUS_RUNNING);
        run.setTriggeredBy("system");
        run.setStartedAt(OffsetDateTime.now());
        run.setRowsRead(0L);
        run.setRowsWritten(0L);
        etlTaskRunRepository.save(run);

        try {
            long[] counts = doJdbcCopy(task);
            run.setStatus(RUN_STATUS_SUCCESS);
            run.setRowsRead(counts[0]);
            run.setRowsWritten(counts[1]);
            run.setFinishedAt(OffsetDateTime.now());
        } catch (Exception e) {
            run.setStatus(RUN_STATUS_FAILED);
            run.setErrorMessage(e.getMessage());
            run.setFinishedAt(OffsetDateTime.now());
        }
        etlTaskRunRepository.save(run);

        task.setLastRunId(run.getId());
        task.setLastRunAt(run.getFinishedAt());
        task.setLastRunStatus(run.getStatus());
        task.setRowsProcessed(run.getRowsWritten());
        etlTaskRepository.save(task);

        return run.getId();
    }

    // =====================================================================
    // JDBC 数据搬运核心逻辑
    // =====================================================================

    /**
     * 执行 JDBC 数据搬运：SELECT * FROM source_table → INSERT INTO target_table。
     *
     * @return long[2]：{rowsRead, rowsWritten}
     */
    private long[] doJdbcCopy(EtlTaskEntity task) {
        // 从 config JSON 中解析 sourceTable 和 transform 类型
        String sourceTable = extractConfigValue(task.getConfig(), "sourceTable");
        String targetTable = task.getTargetTable();
        String transformType = extractConfigValue(task.getConfig(), "transformType");

        // 复杂转换不支持
        if (transformType != null && !transformType.isBlank()
                && !"FULL".equalsIgnoreCase(transformType)
                && !"BATCH".equalsIgnoreCase(transformType)) {
            throw new UnsupportedOperationException(
                    "降级执行器不支持转换类型 '" + transformType + "'，请启用 Flink 引擎");
        }

        if (sourceTable == null || sourceTable.isBlank()) {
            throw new IllegalArgumentException("ETL config 缺少 sourceTable 配置");
        }
        if (targetTable == null || targetTable.isBlank()) {
            throw new IllegalArgumentException("ETL task 缺少 targetTable 配置");
        }

        DataSource sourceDs = dataSourceManager.getDataSource(task.getSourceDsId());
        DataSource targetDs = task.getTargetDsId() != null
                ? dataSourceManager.getDataSource(task.getTargetDsId())
                : sourceDs;

        JdbcTemplate sourceJdbc = new JdbcTemplate(sourceDs);
        JdbcTemplate targetJdbc = new JdbcTemplate(targetDs);

        // 1. 查询源表列信息
        List<String> columnNames = sourceJdbc.query(
                "SELECT * FROM " + sourceTable + " WHERE 1=0",
                (ResultSet rs) -> {
                    List<String> cols = new ArrayList<>();
                    ResultSetMetaData meta = rs.getMetaData();
                    for (int i = 1; i <= meta.getColumnCount(); i++) {
                        cols.add(meta.getColumnName(i));
                    }
                    return cols;
                });

        if (columnNames.isEmpty()) {
            log.warn("源表无列信息 | sourceTable={}", sourceTable);
            return new long[]{0, 0};
        }

        // 2. 查询源表数据并批量写入目标表
        String insertSql = buildInsertSql(targetTable, columnNames);
        long[] rowsRead = {0};

        sourceJdbc.query("SELECT * FROM " + sourceTable, (ResultSet rs) -> {
            Object[] params = new Object[columnNames.size()];
            for (int i = 0; i < columnNames.size(); i++) {
                params[i] = rs.getObject(i + 1);
            }
            targetJdbc.update(insertSql, params);
            rowsRead[0]++;
        });

        long rowsWritten = rowsRead[0];
        log.info("JDBC 数据搬运完成 | source={} target={} rowsRead={} rowsWritten={}",
                sourceTable, targetTable, rowsRead[0], rowsWritten);
        return new long[]{rowsRead[0], rowsWritten};
    }

    private String buildInsertSql(String targetTable, List<String> columns) {
        StringBuilder sb = new StringBuilder();
        sb.append("INSERT INTO ").append(targetTable).append(" (");
        sb.append(String.join(", ", columns));
        sb.append(") VALUES (");
        sb.append(String.join(", ", columns.stream().map(c -> "?").toList()));
        sb.append(")");
        return sb.toString();
    }

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
