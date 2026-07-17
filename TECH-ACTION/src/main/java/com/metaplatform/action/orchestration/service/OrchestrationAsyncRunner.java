package com.metaplatform.action.orchestration.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrchestrationAsyncRunner {

    private final OrchestrationExecutionService orchestrationExecutionService;

    @Async
    public void run(String executionId) {
        try {
            orchestrationExecutionService.processExecution(executionId);
        } catch (Exception e) {
            log.error("Async orchestration execution {} failed", executionId, e);
        }
    }
}
