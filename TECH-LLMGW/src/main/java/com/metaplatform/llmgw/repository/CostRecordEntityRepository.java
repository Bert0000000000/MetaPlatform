package com.metaplatform.llmgw.repository;

import com.metaplatform.llmgw.entity.CostRecordEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface CostRecordEntityRepository extends JpaRepository<CostRecordEntity, Long> {

    List<CostRecordEntity> findByTraceId(String traceId);

    List<CostRecordEntity> findByUserId(String userId);

    List<CostRecordEntity> findByModelId(String modelId);

    List<CostRecordEntity> findByBillingDate(LocalDate billingDate);

    List<CostRecordEntity> findByBillingDateBetween(LocalDate start, LocalDate end);
}
