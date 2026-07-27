package com.metaplatform.ea.process.repository;

import com.metaplatform.ea.process.entity.BusinessProcessRoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BusinessProcessRoleRepository extends JpaRepository<BusinessProcessRoleEntity, UUID> {

    List<BusinessProcessRoleEntity> findByProcessId(UUID processId);

    List<BusinessProcessRoleEntity> findByRoleId(UUID roleId);

    long countByRoleId(UUID roleId);

    void deleteByProcessId(UUID processId);
}
