package com.metaplatform.action.integration.ont;

import com.metaplatform.action.common.ApiResponse;
import com.metaplatform.action.integration.ont.dto.OntologyBindingRequest;
import com.metaplatform.action.integration.ont.dto.OntologyBindingResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/action/definitions")
@RequiredArgsConstructor
public class OntologyBindingController {

    private final OntologyBindingService ontologyBindingService;

    @PostMapping("/{id}/bind-ontology")
    public ApiResponse<OntologyBindingResponse> bind(@PathVariable String id,
                                                     @Valid @RequestBody OntologyBindingRequest request) {
        return ApiResponse.success(ontologyBindingService.bind(id, request));
    }

    @GetMapping("/{id}/ontology-binding")
    public ApiResponse<OntologyBindingResponse> getBinding(@PathVariable String id) {
        return ApiResponse.success(ontologyBindingService.getBinding(id));
    }
}
