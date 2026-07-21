package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.dto.session.UserSessionResponse;
import com.metaplatform.iam.service.UserSessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/iam/sessions")
@RequiredArgsConstructor
public class UserSessionController {

    private final UserSessionService userSessionService;

    @GetMapping
    public ApiResponse<List<UserSessionResponse>> list(@RequestParam String userId) {
        return ApiResponse.success(userSessionService.listByUserId(userId));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> terminate(@PathVariable String id) {
        userSessionService.terminate(id);
        return ApiResponse.success();
    }
}
