package com.metaplatform.ai.billing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface BillingRepository extends JpaRepository<TokenUsage, Long> {

    @Query("SELECT SUM(t.totalTokens) FROM TokenUsage t WHERE t.tenantId = :tenantId AND t.usageDate = :date")
    Integer sumTotalTokensByTenantAndDate(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date);

    @Query("SELECT SUM(t.totalTokens) FROM TokenUsage t WHERE t.tenantId = :tenantId AND t.usageDate BETWEEN :from AND :to")
    Integer sumTotalTokensByTenantAndDateRange(@Param("tenantId") UUID tenantId,
                                                @Param("from") LocalDate from,
                                                @Param("to") LocalDate to);

    @Query("SELECT t.model, SUM(t.totalTokens) FROM TokenUsage t WHERE t.tenantId = :tenantId AND t.usageDate = :date GROUP BY t.model")
    List<Object[]> sumTokensByModelAndDate(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date);

    List<TokenUsage> findByTenantIdAndUsageDate(UUID tenantId, LocalDate date);
}
