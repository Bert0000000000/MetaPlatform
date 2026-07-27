package com.metaplatform.ont.repository;

import com.metaplatform.ont.entity.OntologyDiscoveryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OntologyDiscoveryRepository extends JpaRepository<OntologyDiscoveryEntity, String> {

    List<OntologyDiscoveryEntity> findByTenantIdAndSourceId(String tenantId, String sourceId);

    List<OntologyDiscoveryEntity> findByTenantId(String tenantId);

    List<OntologyDiscoveryEntity> findByTenantIdAndStatus(String tenantId, String status);
}