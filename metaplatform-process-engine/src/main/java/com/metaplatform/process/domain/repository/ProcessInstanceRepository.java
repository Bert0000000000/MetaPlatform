package com.metaplatform.process.domain.repository;

import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.enums.InstanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessInstanceRepository extends JpaRepository<ProcessInstance, Long>,
        JpaSpecificationExecutor<ProcessInstance> {

    List<ProcessInstance> findByStatus(InstanceStatus status);

    List<ProcessInstance> findByDefinitionCode(String definitionCode);

    List<ProcessInstance> findByInitiatorId(String initiatorId);
}
