package com.metaplatform.ea.application.repository;

import com.metaplatform.ea.application.entity.ApplicationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ApplicationRepository extends JpaRepository<ApplicationEntity, UUID> {

    Optional<ApplicationEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<ApplicationEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}
