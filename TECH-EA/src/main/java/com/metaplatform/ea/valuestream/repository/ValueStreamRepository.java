package com.metaplatform.ea.valuestream.repository;

import com.metaplatform.ea.valuestream.entity.ValueStreamEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ValueStreamRepository extends JpaRepository<ValueStreamEntity, UUID> {

    Optional<ValueStreamEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<ValueStreamEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}
