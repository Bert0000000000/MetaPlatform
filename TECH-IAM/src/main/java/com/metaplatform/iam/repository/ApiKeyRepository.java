package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.ApiKeyEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ApiKeyRepository extends JpaRepository<ApiKeyEntity, String> {

    Optional<ApiKeyEntity> findByKeyHash(String keyHash);

    Page<ApiKeyEntity> findByTenantId(String tenantId, Pageable pageable);

    boolean existsByTenantIdAndName(String tenantId, String name);
}
