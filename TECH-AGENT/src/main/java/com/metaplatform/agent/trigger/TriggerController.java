package com.metaplatform.agent.trigger;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/agent/triggers")
@RequiredArgsConstructor
public class TriggerController {
    private final TriggerRepository repository;

    @PostMapping
    public ApiResponse<TriggerEntity> create(@RequestBody TriggerEntity t) {
        t.setId("TRG-" + UUID.randomUUID());
        t.setTenantId(TenantContext.getTenantIdOrDefault());
        t.setEnabled(true);
        t.setCreatedAt(Instant.now());
        return ApiResponse.success(repository.save(t));
    }

    @GetMapping
    public ApiResponse<List<TriggerEntity>> list() {
        return ApiResponse.success(repository.findByTenantId(TenantContext.getTenantIdOrDefault()));
    }

    @PostMapping("/{id}/disable")
    public ApiResponse<Void> disable(@PathVariable String id) {
        TriggerEntity t = repository.findById(id).orElseThrow();
        t.setEnabled(false);
        repository.save(t);
        return ApiResponse.success();
    }
}
