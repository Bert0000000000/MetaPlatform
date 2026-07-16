package com.metaplatform.process.application;

import com.metaplatform.process.domain.ProcessHistoryEvent;
import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.enums.HistoryEventType;
import com.metaplatform.process.domain.repository.ProcessHistoryRepository;
import com.metaplatform.process.infrastructure.util.JsonUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class ProcessHistoryService {

    private final ProcessHistoryRepository repository;

    public ProcessHistoryService(ProcessHistoryRepository repository) {
        this.repository = repository;
    }

    public void record(ProcessInstance instance, HistoryEventType eventType,
                        String nodeId, String actorId, Object detail) {
        ProcessHistoryEvent event = new ProcessHistoryEvent();
        event.setInstanceId(instance.getId());
        event.setEventType(eventType);
        event.setNodeId(nodeId);
        event.setActorId(actorId);
        event.setDetail(detail != null ? JsonUtils.toJson(detail) : null);
        event.setTimestamp(LocalDateTime.now());
        repository.save(event);
    }

    /**
     * Query complete history of a process instance
     */
    public List<ProcessHistoryEvent> getInstanceHistory(Long instanceId) {
        return repository.findByInstanceIdOrderByTimestampAsc(instanceId);
    }

    /**
     * Query operation history of a node
     */
    public List<ProcessHistoryEvent> getNodeHistory(Long instanceId, String nodeId) {
        return repository.findByInstanceIdAndNodeIdOrderByTimestampAsc(instanceId, nodeId);
    }

    /**
     * Query operation history of an actor
     */
    public Page<ProcessHistoryEvent> getActorHistory(String actorId, Pageable pageable) {
        return repository.findByActorIdOrderByTimestampDesc(actorId, pageable);
    }
}
