package com.metaplatform.kb.repository;

import com.metaplatform.kb.entity.KbBindingEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KbBindingRepository extends JpaRepository<KbBindingEntity, String> {
    List<KbBindingEntity> findByTenantIdAndBindTypeAndBindKeyAndEnabledTrue(String tenantId, String bindType, String bindKey);
    List<KbBindingEntity> findByTenantIdAndKbIdAndEnabledTrue(String tenantId, String kbId);
}
