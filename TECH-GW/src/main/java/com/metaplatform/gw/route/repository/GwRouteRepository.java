package com.metaplatform.gw.route.repository;

import com.metaplatform.gw.route.entity.GwRouteEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GwRouteRepository extends JpaRepository<GwRouteEntity, String> {

    Optional<GwRouteEntity> findByTenantIdAndRouteId(String tenantId, String routeId);

    boolean existsByTenantIdAndRouteId(String tenantId, String routeId);

    Page<GwRouteEntity> findByTenantIdOrderByPriorityDescCreatedAtDesc(String tenantId, Pageable pageable);

    @Query("SELECT r FROM GwRouteEntity r WHERE r.enabled = true ORDER BY r.priority DESC, r.createdAt ASC")
    List<GwRouteEntity> findAllEnabledRoutes();

    @Query("SELECT r FROM GwRouteEntity r WHERE r.tenantId = :tenantId AND r.enabled = true ORDER BY r.priority DESC, r.createdAt ASC")
    List<GwRouteEntity> findEnabledRoutesByTenant(@Param("tenantId") String tenantId);
}
