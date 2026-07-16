package com.metaplatform.process.api;

import com.metaplatform.process.api.dto.ProcessDefinitionCreateRequest;
import com.metaplatform.process.api.dto.ProcessDefinitionUpdateRequest;
import com.metaplatform.process.application.DefinitionValidator;
import com.metaplatform.process.application.DslParser;
import com.metaplatform.process.application.ValidationResult;
import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.dsl.ProcessDsl;
import com.metaplatform.process.domain.enums.DefinitionStatus;
import com.metaplatform.process.domain.repository.ProcessDefinitionRepository;
import com.metaplatform.process.infrastructure.exception.ResourceNotFoundException;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/process-definitions")
public class ProcessDefinitionController {

    private final ProcessDefinitionRepository repository;
    private final DslParser dslParser;
    private final DefinitionValidator validator;

    public ProcessDefinitionController(ProcessDefinitionRepository repository,
                                        DslParser dslParser,
                                        DefinitionValidator validator) {
        this.repository = repository;
        this.dslParser = dslParser;
        this.validator = validator;
    }

    @GetMapping
    public Page<ProcessDefinition> list(
            @RequestParam(required = false) DefinitionStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Specification<ProcessDefinition> spec = buildSpec(status);
        return repository.findAll(spec,
            PageRequest.of(page, size, Sort.by("createdAt").descending()));
    }

    @GetMapping("/{id}")
    public ProcessDefinition getById(@PathVariable Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("ProcessDefinition", id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProcessDefinition create(@Valid @RequestBody ProcessDefinitionCreateRequest req) {
        // Validate DSL
        ProcessDsl dsl = dslParser.parse(req.getDslJson());
        ValidationResult result = validator.validate(dsl);
        if (!result.isValid()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "DSL invalid: " + result.getErrors());
        }

        ProcessDefinition definition = new ProcessDefinition();
        definition.setName(dsl.getName());
        definition.setCode(dsl.getKey());
        definition.setDescription(dsl.getDescription());
        definition.setVersion(1);
        definition.setStatus(DefinitionStatus.DRAFT);
        definition.setDslJson(req.getDslJson());
        definition.setTriggerType(req.getTriggerType());
        definition.setTriggerConfig(req.getTriggerConfig());
        definition.setCreatedBy("api");
        definition.setCreatedAt(LocalDateTime.now());
        definition.setUpdatedAt(LocalDateTime.now());

        return repository.save(definition);
    }

    @PutMapping("/{id}")
    public ProcessDefinition update(@PathVariable Long id,
                                     @Valid @RequestBody ProcessDefinitionUpdateRequest req) {
        ProcessDefinition existing = getById(id);
        if (existing.getStatus() == DefinitionStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Cannot modify active definition, please suspend first");
        }

        ProcessDsl dsl = dslParser.parse(req.getDslJson());
        ValidationResult result = validator.validate(dsl);
        if (!result.isValid()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "DSL invalid: " + result.getErrors());
        }

        existing.setName(req.getName() != null ? req.getName() : dsl.getName());
        existing.setDslJson(req.getDslJson());
        existing.setUpdatedAt(LocalDateTime.now());
        return repository.save(existing);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        ProcessDefinition existing = getById(id);
        if (existing.getStatus() == DefinitionStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Cannot delete active definition");
        }
        repository.deleteById(id);
    }

    @PostMapping("/{id}/activate")
    public ProcessDefinition activate(@PathVariable Long id) {
        ProcessDefinition definition = getById(id);
        definition.setStatus(DefinitionStatus.ACTIVE);
        definition.setUpdatedAt(LocalDateTime.now());
        return repository.save(definition);
    }

    @PostMapping("/{id}/suspend")
    public ProcessDefinition suspend(@PathVariable Long id) {
        ProcessDefinition definition = getById(id);
        definition.setStatus(DefinitionStatus.SUSPENDED);
        definition.setUpdatedAt(LocalDateTime.now());
        return repository.save(definition);
    }

    private Specification<ProcessDefinition> buildSpec(DefinitionStatus status) {
        return (root, query, cb) -> {
            if (status != null) {
                return cb.equal(root.get("status"), status);
            }
            return cb.conjunction();
        };
    }
}
