package com.metaplatform.ea.landscape.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.landscape.dto.LandscapeView;
import com.metaplatform.ea.landscape.service.LandscapeViewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 架构分层视图 REST API。
 *
 * <p>路径前缀 {@code /api/v1/ea/landscape}。
 */
@RestController
@RequestMapping("/api/v1/ea/landscape")
@RequiredArgsConstructor
public class LandscapeController {

    private final LandscapeViewService landscapeViewService;

    @GetMapping
    public ApiResponse<LandscapeView> landscape() {
        return ApiResponse.success(landscapeViewService.buildLandscape());
    }
}
