package com.metaplatform.ont.metric;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MetricRepository extends JpaRepository<MetricEntity, String> {

    Optional<MetricEntity> findByTenantIdAndMetricCode(String tenantId, String metricCode);

    List<MetricEntity> findByTenantIdAndConceptCodeAndEnabledTrue(String tenantId, String conceptCode);

    List<MetricEntity> findByTenantIdAndEnabledTrue(String tenantId);
}
