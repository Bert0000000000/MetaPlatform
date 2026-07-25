package com.metaplatform.rag.context.controller;

import com.metaplatform.rag.common.ApiResponse;
import com.metaplatform.rag.context.dto.ContextAssembleRequest;
import com.metaplatform.rag.context.dto.ContextAssembleResponse;
import com.metaplatform.rag.context.service.ContextAssemblyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rag/context")
@RequiredArgsConstructor
public class ContextController {

    private final ContextAssemblyService contextAssemblyService;

    @PostMapping("/assemble")
    public ApiResponse<ContextAssembleResponse> assemble(@RequestBody ContextAssembleRequest request) {
        return ApiResponse.ok(contextAssemblyService.assemble(request));
    }
}
