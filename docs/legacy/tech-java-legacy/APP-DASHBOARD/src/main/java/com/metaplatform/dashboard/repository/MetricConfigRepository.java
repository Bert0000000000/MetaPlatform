package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.MetricConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MetricConfigRepository extends JpaRepository<MetricConfigEntity, Long> {

    List<MetricConfigEntity> findByUserIdOrderBySortOrderAsc(String userId);

    Optional<MetricConfigEntity> findByUserIdAndMetricId(String userId, String metricId);

    void deleteByUserId(String userId);
}
