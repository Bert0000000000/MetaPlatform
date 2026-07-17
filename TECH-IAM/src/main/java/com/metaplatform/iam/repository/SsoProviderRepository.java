package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.sso.SsoProviderEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SsoProviderRepository extends JpaRepository<SsoProviderEntity, String> {

    Optional<SsoProviderEntity> findByIdAndDeletedFalse(String id);

    boolean existsByTenantIdAndNameAndDeletedFalse(String tenantId, String name);

    Page<SsoProviderEntity> findByTenantIdAndDeletedFalse(String tenantId, Pageable pageable);

    Optional<SsoProviderEntity> findByTenantIdAndNameAndDeletedFalse(String tenantId, String name);

    @Query("SELECT s FROM SsoProviderEntity s WHERE s.tenantId = :tenantId AND s.deleted = false " +
            "AND (LOWER(s.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "OR LOWER(s.clientId) LIKE LOWER(CONCAT('%', :keyword, '%'))) ")
    Page<SsoProviderEntity> searchByKeyword(@Param("tenantId") String tenantId,
                                            @Param("keyword") String keyword,
                                            Pageable pageable);
}
