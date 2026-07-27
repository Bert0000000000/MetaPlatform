package com.metaplatform.ont.action;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Action Service（P1.1.4）。
 *
 * <p>负责 Action 定义的 CRUD 与查询。Execution 与审批链路在 P5.1（ActionGuard）
 * 与 P5.2（Temporal/WFE）中实现。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ActionService {

    private final ActionRepository repository;

    public ActionEntity create(ActionEntity a) {
        a.setCreatedAt(Instant.now());
        a.setUpdatedAt(Instant.now());
        if (a.getVersion() == 0) a.setVersion(1);
        if (a.getRiskLevel() == null) a.setRiskLevel("LOW");
        return repository.save(a);
    }

    public ActionEntity update(String id, ActionEntity patch) {
        ActionEntity e = repository.findById(id).orElseThrow();
        if (patch.getDisplayName() != null) e.setDisplayName(patch.getDisplayName());
        if (patch.getDescription() != null) e.setDescription(patch.getDescription());
        if (patch.getParameterSchema() != null) e.setParameterSchema(patch.getParameterSchema());
        if (patch.getReturnSchema() != null) e.setReturnSchema(patch.getReturnSchema());
        if (patch.getRiskLevel() != null) e.setRiskLevel(patch.getRiskLevel());
        e.setApprovalRequired(patch.isApprovalRequired());
        if (patch.getIdempotencyKey() != null) e.setIdempotencyKey(patch.getIdempotencyKey());
        if (patch.getSideEffect() != null) e.setSideEffect(patch.getSideEffect());
        e.setEnabled(patch.isEnabled());
        e.setVersion(e.getVersion() + 1);
        e.setUpdatedAt(Instant.now());
        return repository.save(e);
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    public ActionEntity get(String id) {
        return repository.findById(id).orElseThrow();
    }

    public ActionEntity getByCode(String tenantId, String actionCode) {
        return repository.findByTenantIdAndActionCode(tenantId, actionCode).orElseThrow();
    }

    public List<ActionEntity> listByConcept(String tenantId, String conceptCode) {
        return repository.findByTenantIdAndTargetConceptCodeAndEnabledTrue(tenantId, conceptCode);
    }

    public List<ActionEntity> listByRisk(String tenantId, String riskLevel) {
        return repository.findByTenantIdAndRiskLevelAndEnabledTrue(tenantId, riskLevel);
    }

    public List<ActionEntity> listAll(String tenantId) {
        return repository.findAll().stream()
                .filter(a -> a.getTenantId().equals(tenantId) && a.isEnabled())
                .toList();
    }
}
