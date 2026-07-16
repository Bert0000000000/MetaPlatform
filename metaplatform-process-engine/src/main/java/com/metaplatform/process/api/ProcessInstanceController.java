package com.metaplatform.process.api;

import com.metaplatform.process.api.dto.ProcessCancelRequest;
import com.metaplatform.process.api.dto.ProcessStartRequest;
import com.metaplatform.process.application.ManualStartService;
import com.metaplatform.process.application.ProcessHistoryService;
import com.metaplatform.process.domain.ProcessHistoryEvent;
import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.enums.InstanceStatus;
import com.metaplatform.process.domain.repository.ProcessInstanceRepository;
import com.metaplatform.process.infrastructure.exception.ResourceNotFoundException;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/process-instances")
public class ProcessInstanceController {

    private final ManualStartService manualStartService;
    private final ProcessInstanceRepository instanceRepository;
    private final ProcessHistoryService historyService;

    public ProcessInstanceController(ManualStartService manualStartService,
                                      ProcessInstanceRepository instanceRepository,
                                      ProcessHistoryService historyService) {
        this.manualStartService = manualStartService;
        this.instanceRepository = instanceRepository;
        this.historyService = historyService;
    }

    @GetMapping
    public Page<ProcessInstance> list(
            @RequestParam(required = false) InstanceStatus status,
            @RequestParam(required = false) String definitionCode,
            @RequestParam(required = false) String initiatorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Specification<ProcessInstance> spec = buildSpec(status, definitionCode, initiatorId);
        return instanceRepository.findAll(spec,
            PageRequest.of(page, size, Sort.by("startedAt").descending()));
    }

    @GetMapping("/{id}")
    public ProcessInstance getById(@PathVariable Long id) {
        return instanceRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("ProcessInstance", id));
    }

    @GetMapping("/{id}/history")
    public List<ProcessHistoryEvent> getHistory(@PathVariable Long id) {
        return historyService.getInstanceHistory(id);
    }

    @PostMapping("/start")
    @ResponseStatus(HttpStatus.CREATED)
    public ProcessInstance startProcess(@Valid @RequestBody ProcessStartRequest request) {
        return manualStartService.start(
            request.getDefinitionCode(),
            "api-user",
            request.getBusinessKey(),
            request.getVariables()
        );
    }

    @PostMapping("/{id}/cancel")
    public ProcessInstance cancel(@PathVariable Long id,
                                   @Valid @RequestBody ProcessCancelRequest request) {
        manualStartService.cancel(id, "api-user", request.getReason());
        return getById(id);
    }

    private Specification<ProcessInstance> buildSpec(InstanceStatus status,
                                                      String definitionCode,
                                                      String initiatorId) {
        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (definitionCode != null) predicates.add(cb.equal(root.get("definitionCode"), definitionCode));
            if (initiatorId != null) predicates.add(cb.equal(root.get("initiatorId"), initiatorId));
            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }
}
