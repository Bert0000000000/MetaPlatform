package com.metaplatform.ont.repository;

import com.metaplatform.ont.entity.AttributeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttributeRepository extends JpaRepository<AttributeEntity, String> {

    Optional<AttributeEntity> findByTenantIdAndCode(String tenantId, String code);

    boolean existsByTenantIdAndCode(String tenantId, String code);

    List<AttributeEntity> findByTenantId(String tenantId);

    List<AttributeEntity> findByTenantIdAndCodeIn(String tenantId, List<String> codes);
}
