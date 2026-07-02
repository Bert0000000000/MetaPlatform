package com.metaplatform.process.infrastructure.consumer;

import com.metaplatform.process.application.ProcessEngine;
import com.metaplatform.process.application.TriggerMatcher;
import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.enums.DefinitionStatus;
import com.metaplatform.process.domain.repository.ProcessDefinitionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ObjectEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(ObjectEventConsumer.class);

    private final ProcessEngine processEngine;
    private final ProcessDefinitionRepository definitionRepository;
    private final TriggerMatcher triggerMatcher;

    public ObjectEventConsumer(ProcessEngine processEngine,
                                ProcessDefinitionRepository definitionRepository,
                                TriggerMatcher triggerMatcher) {
        this.processEngine = processEngine;
        this.definitionRepository = definitionRepository;
        this.triggerMatcher = triggerMatcher;
    }

    @KafkaListener(topics = "metaplatform.object-events", groupId = "process-engine")
    public void consumeEvent(ObjectEvent event) {
        log.info("Received object event: objectType={}, eventType={}, objectId={}",
            event.getObjectType(), event.getEventType(), event.getObjectId());

        // Find matching trigger definitions
        List<ProcessDefinition> definitions = definitionRepository
            .findByTriggerTypeAndStatus("OBJECT_EVENT", DefinitionStatus.ACTIVE);

        for (ProcessDefinition definition : definitions) {
            try {
                if (triggerMatcher.matches(event.getObjectType(), event.getEventType(),
                        event.getData(), definition.getTriggerConfig())) {
                    Map<String, Object> variables = buildVariables(event);
                    processEngine.startProcess(
                        definition.getCode(),
                        event.getActorId() != null ? event.getActorId() : "SYSTEM",
                        event.getObjectId(),
                        variables
                    );
                    log.info("Started process {} from event", definition.getCode());
                }
            } catch (Exception e) {
                log.error("Failed to start process {} from event: {}",
                    definition.getCode(), e.getMessage(), e);
            }
        }
    }

    private Map<String, Object> buildVariables(ObjectEvent event) {
        Map<String, Object> variables = new HashMap<>();
        if (event.getData() != null) {
            variables.putAll(event.getData());
        }
        variables.put("_objectType", event.getObjectType());
        variables.put("_eventType", event.getEventType());
        variables.put("_objectId", event.getObjectId());
        return variables;
    }
}
