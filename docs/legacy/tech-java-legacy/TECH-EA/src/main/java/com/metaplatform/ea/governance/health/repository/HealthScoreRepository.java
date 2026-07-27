package com.metaplatform.ea.governance.health.repository;

import com.metaplatform.ea.governance.health.entity.HealthScoreEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface HealthScoreRepository extends JpaRepository<HealthScoreEntity, UUID> {

    List<HealthScoreEntity> findByTenantIdAndScoreDate(String tenantId, LocalDate scoreDate);

    List<HealthScoreEntity> findByTenantIdAndDimensionAndScoreDateBetweenOrderByScoreDateAsc(
            String tenantId, String dimension, LocalDate start, LocalDate end);

    Optional<HealthScoreEntity> findByTenantIdAndScoreDateAndDimension(
            String tenantId, LocalDate scoreDate, String dimension);

    List<HealthScoreEntity> findByTenantIdAndScoreDateBetweenOrderByScoreDateAsc(
            String tenantId, LocalDate start, LocalDate end);
}
