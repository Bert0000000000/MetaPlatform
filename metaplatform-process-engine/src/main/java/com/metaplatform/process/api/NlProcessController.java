package com.metaplatform.process.api;

import com.metaplatform.process.api.dto.NlProcessGenerateRequest;
import com.metaplatform.process.application.NlProcessGenerator;
import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.repository.ProcessDefinitionRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/nl-process")
public class NlProcessController {

    private final NlProcessGenerator nlGenerator;
    private final ProcessDefinitionRepository repository;

    public NlProcessController(NlProcessGenerator nlGenerator,
                                ProcessDefinitionRepository repository) {
        this.nlGenerator = nlGenerator;
        this.repository = repository;
    }

    @PostMapping("/generate")
    @ResponseStatus(HttpStatus.CREATED)
    public ProcessDefinition generate(@Valid @RequestBody NlProcessGenerateRequest request) {
        return nlGenerator.generate(request.getDescription());
    }

    @PostMapping("/generate-and-activate")
    public ProcessDefinition generateAndActivate(
            @Valid @RequestBody NlProcessGenerateRequest request) {
        ProcessDefinition definition = nlGenerator.generate(request.getDescription());
        definition.setStatus(com.metaplatform.process.domain.enums.DefinitionStatus.ACTIVE);
        return repository.save(definition);
    }

    @PostMapping("/preview")
    public String preview(@Valid @RequestBody NlProcessGenerateRequest request) {
        ProcessDefinition definition = nlGenerator.generate(request.getDescription());
        return definition.getDslJson();
    }
}
