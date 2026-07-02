package com.metaplatform.process.application;

import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.enums.InstanceStatus;
import com.metaplatform.process.domain.repository.ProcessInstanceRepository;
import com.metaplatform.process.infrastructure.exception.ProcessEngineException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@Transactional
public class ManualStartService {

    private final ProcessEngine processEngine;
    private final ProcessInstanceRepository instanceRepository;

    public ManualStartService(ProcessEngine processEngine,
                               ProcessInstanceRepository instanceRepository) {
        this.processEngine = processEngine;
        this.instanceRepository = instanceRepository;
    }

    /**
     * Manually start a process
     */
    public ProcessInstance start(String definitionCode, String initiatorId,
                                  String businessKey, Map<String, Object> variables) {
        return processEngine.startProcess(definitionCode, initiatorId, businessKey, variables);
    }

    /**
     * Cancel a process
     */
    public void cancel(Long instanceId, String operatorId, String reason) {
        processEngine.cancelProcess(instanceId, operatorId, reason);
    }
}
