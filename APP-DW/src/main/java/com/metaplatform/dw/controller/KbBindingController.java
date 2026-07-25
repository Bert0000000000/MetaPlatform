package com.metaplatform.dw.controller;

import com.metaplatform.dw.entity.KbBindingEntity;
import com.metaplatform.dw.entity.RetrievalConfigEntity;
import com.metaplatform.dw.service.KbBindingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/dw/employees/{employeeId}")
@RequiredArgsConstructor
public class KbBindingController {
    private final KbBindingService service;

    @PostMapping("/kb-bindings")
    public KbBindingEntity bind(@PathVariable String employeeId, @RequestBody Map<String, Object> body) {
        String kbId = (String) body.get("kbId");
        String configId = (String) body.get("retrievalConfigId");
        Integer priority = body.get("priority") == null ? null : ((Number) body.get("priority")).intValue();
        return service.bindKb(employeeId, kbId, configId, priority);
    }

    @DeleteMapping("/kb-bindings/{kbId}")
    public void unbind(@PathVariable String employeeId, @PathVariable String kbId) {
        service.unbindKb(employeeId, kbId);
    }

    @GetMapping("/kb-bindings")
    public List<KbBindingEntity> list(@PathVariable String employeeId) {
        return service.listBindings(employeeId);
    }

    @GetMapping("/retrieval-config")
    public RetrievalConfigEntity getRetrievalConfig(@PathVariable String employeeId) {
        return service.getOrCreateRetrievalConfig(employeeId);
    }

    @PutMapping("/retrieval-config")
    public RetrievalConfigEntity updateRetrievalConfig(@PathVariable String employeeId, @RequestBody RetrievalConfigEntity cfg) {
        cfg.setEmployeeId(employeeId);
        return service.updateRetrievalConfig(cfg);
    }
}