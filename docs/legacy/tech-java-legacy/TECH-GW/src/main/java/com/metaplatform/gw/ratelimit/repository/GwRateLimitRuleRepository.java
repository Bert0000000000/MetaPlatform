package com.metaplatform.gw.ratelimit.repository;

import com.metaplatform.gw.ratelimit.entity.GwRateLimitRuleEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GwRateLimitRuleRepository extends JpaRepository<GwRateLimitRuleEntity, String> {

    Optional<GwRateLimitRuleEntity> findByRuleIdAndDeletedAtIsNull(String ruleId);

    boolean existsByTenantIdAndRuleNameAndDeletedAtIsNull(String tenantId, String ruleName);

    boolean existsByTenantIdAndRouteIdAndScopeAndLimitTypeAndDeletedAtIsNull(
            String tenantId, String routeId, String scope, String limitType);

    @Query("SELECT r FROM GwRateLimitRuleEntity r " +
           "WHERE r.tenantId = :tenantId AND r.deletedAt IS NULL " +
           "AND (:keyword IS NULL OR r.ruleName LIKE %:keyword% OR r.description LIKE %:keyword%) " +
           "AND (:status IS NULL OR r.status = :status) " +
           "AND (:routeId IS NULL OR r.routeId = :routeId) " +
           "AND (:scope IS NULL OR r.scope = :scope) " +
           "AND (:limitType IS NULL OR r.limitType = :limitType)")
    Page<GwRateLimitRuleEntity> searchRules(
            @Param("tenantId") String tenantId,
            @Param("keyword") String keyword,
            @Param("status") String status,
            @Param("routeId") String routeId,
            @Param("scope") String scope,
            @Param("limitType") String limitType,
            Pageable pageable);
}
