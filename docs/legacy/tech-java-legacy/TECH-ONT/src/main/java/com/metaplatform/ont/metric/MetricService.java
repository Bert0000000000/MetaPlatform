package com.metaplatform.ont.metric;

import com.metaplatform.ont.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Metric Service（P1.1.3）。
 *
 * <p>提供：</p>
 * <ul>
 *   <li>CRUD：通过 MetricController 暴露 REST API</li>
 *   <li>{@link #execute}：把公式 SQL 中的 :tenantId/:conceptCode/:objectId 占位符替换后执行</li>
 *   <li>{@link #explain}：返回公式 + 输入输出契约（供 Grounding）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MetricService {

    private static final Pattern PLACEHOLDER = Pattern.compile(":([a-zA-Z_][a-zA-Z0-9_]*)");

    private final MetricRepository repository;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public MetricEntity create(MetricEntity m) {
        return repository.save(m);
    }

    public MetricEntity update(String id, MetricEntity patch) {
        MetricEntity e = repository.findById(id).orElseThrow();
        if (patch.getFormulaSql() != null) e.setFormulaSql(patch.getFormulaSql());
        if (patch.getDisplayName() != null) e.setDisplayName(patch.getDisplayName());
        if (patch.getDescription() != null) e.setDescription(patch.getDescription());
        if (patch.getCacheTtlSec() > 0) e.setCacheTtlSec(patch.getCacheTtlSec());
        if (patch.getAggregation() != null) e.setAggregation(patch.getAggregation());
        e.setEnabled(patch.isEnabled());
        e.setVersion(e.getVersion() + 1);
        return repository.save(e);
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    public MetricEntity get(String id) {
        return repository.findById(id).orElseThrow();
    }

    public List<MetricEntity> listByConcept(String tenantId, String conceptCode) {
        return repository.findByTenantIdAndConceptCodeAndEnabledTrue(tenantId, conceptCode);
    }

    public List<MetricEntity> listAll(String tenantId) {
        return repository.findByTenantIdAndEnabledTrue(tenantId);
    }

    /**
     * 执行 Metric 查询。
     *
     * @param tenantId 租户
     * @param metricCode 指标编码
     * @param objectId 业务对象 ID（可选；用于按对象维度聚合）
     * @param extraParams 额外参数（如 region、timeRange 等）
     */
    public Object execute(String tenantId, String metricCode, String objectId,
                          Map<String, Object> extraParams) {
        MetricEntity metric = repository.findByTenantIdAndMetricCode(tenantId, metricCode)
                .orElseThrow(() -> new IllegalArgumentException("metric not found: " + metricCode));
        String sql = render(metric.getFormulaSql(), tenantId, metric.getConceptCode(), objectId, extraParams);
        log.debug("[Metric] execute tenant={} code={} sql={}", tenantId, metricCode, sql);
        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource(extraParams == null ? Map.of() : extraParams));
    }

    /**
     * 解释 Metric：用于 Ontology Grounding 把用户意图匹配到具体 Metric。
     */
    public Map<String, Object> explain(String tenantId, String metricCode) {
        MetricEntity m = repository.findByTenantIdAndMetricCode(tenantId, metricCode)
                .orElseThrow(() -> new IllegalArgumentException("metric not found: " + metricCode));
        return Map.of(
                "metricCode", m.getMetricCode(),
                "conceptCode", m.getConceptCode(),
                "displayName", m.getDisplayName(),
                "description", m.getDescription() == null ? "" : m.getDescription(),
                "returnType", m.getReturnType(),
                "unit", m.getUnit() == null ? "" : m.getUnit(),
                "aggregation", m.getAggregation(),
                "dimensions", m.getDimensions() == null ? List.of() : List.of(m.getDimensions().split(","))
        );
    }

    private String render(String sql, String tenantId, String conceptCode, String objectId,
                          Map<String, Object> extraParams) {
        Matcher matcher = PLACEHOLDER.matcher(sql);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String name = matcher.group(1);
            Object value = switch (name) {
                case "tenantId" -> tenantId;
                case "conceptCode" -> conceptCode;
                case "objectId" -> objectId == null ? "" : objectId;
                default -> extraParams == null ? null : extraParams.get(name);
            };
            matcher.appendReplacement(out, Matcher.quoteReplacement(value == null ? "NULL" : value.toString()));
        }
        matcher.appendTail(out);
        return out.toString();
    }
}
