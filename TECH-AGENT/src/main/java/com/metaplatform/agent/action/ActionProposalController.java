package com.metaplatform.agent.action;

import com.metaplatform.agent.action.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/agent/action-proposals")
@RequiredArgsConstructor
public class ActionProposalController {
    private final ActionProposalService service;
    @PostMapping
    public ResponseEntity<ActionProposalDto> create(@Valid @RequestBody ActionProposalCreateRequest request) {
        return ResponseEntity.status(201).body(service.create(request));
    }
    @GetMapping("/{proposalId}")
    public ActionProposalDto get(@PathVariable String proposalId) { return service.get(proposalId); }
}
