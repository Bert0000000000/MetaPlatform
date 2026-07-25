package com.metaplatform.ea.application.controller;

import com.metaplatform.ea.application.dto.ApplicationTechComponentLinkResponse;
import com.metaplatform.ea.application.service.ApplicationTechComponentService;
import com.metaplatform.ea.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * 应用-技术组件关联 REST API。
 *
 * <p>路径前缀 {@code /api/v1/ea/application-tech-components}。
 */
@RestController
@RequestMapping("/api/v1/ea/application-tech-components")
@RequiredArgsConstructor
public class ApplicationTechComponentController {

    private final ApplicationTechComponentService linkService;

    @PostMapping
    public ApiResponse<ApplicationTechComponentLinkResponse> link(
            @RequestParam UUID applicationId,
            @RequestParam UUID techComponentId,
            @RequestParam(required = false, defaultValue = "USES") String relationshipType) {
        return ApiResponse.success(linkService.link(applicationId, techComponentId, relationshipType));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> unlink(@PathVariable UUID id) {
        linkService.unlink(id);
        return ApiResponse.success();
    }

    @GetMapping(params = "applicationId")
    public ApiResponse<List<ApplicationTechComponentLinkResponse>> findByApplication(
            @RequestParam UUID applicationId) {
        return ApiResponse.success(linkService.findByApplicationId(applicationId));
    }

    @GetMapping(params = "techComponentId")
    public ApiResponse<List<ApplicationTechComponentLinkResponse>> findByTechComponent(
            @RequestParam UUID techComponentId) {
        return ApiResponse.success(linkService.findByTechComponentId(techComponentId));
    }
}
