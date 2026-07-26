package com.metaplatform.agent.skills;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/agent/skills")
@RequiredArgsConstructor
public class SkillController {
    private final SkillService service;

    @PostMapping public ApiResponse<SkillEntity> create(@RequestBody SkillEntity s) {
        s.setTenantId(TenantContext.getTenantIdOrDefault());
        return ApiResponse.success(service.register(s));
    }

    @PutMapping("/{id}") public ApiResponse<SkillEntity> update(@PathVariable String id, @RequestBody SkillEntity p) {
        return ApiResponse.success(service.update(id, p));
    }

    @GetMapping("/{skillCode}") public ApiResponse<SkillEntity> get(@PathVariable String skillCode) {
        return ApiResponse.success(service.get(TenantContext.getTenantIdOrDefault(), skillCode));
    }
}
