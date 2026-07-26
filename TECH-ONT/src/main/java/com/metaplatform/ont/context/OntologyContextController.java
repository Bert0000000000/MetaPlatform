package com.metaplatform.ont.context;

import com.metaplatform.ont.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Ontology Context REST API（P1.2.2）。
 *
 * <ul>
 *   <li>POST /api/v1/ont/context/build — 构建 Envelope</li>
 *   <li>POST /api/v1/ont/context/verify — 校验 Envelope</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/ont/context")
@RequiredArgsConstructor
public class OntologyContextController {

    private final OntologyContextService service;

    @PostMapping("/build")
    public ApiResponse<OntologyContextEnvelope> build(@RequestBody OntologyContextService.OntologyContextRequest request) {
        return ApiResponse.success(service.build(request));
    }

    @PostMapping("/verify")
    public ApiResponse<VerifyResponse> verify(@RequestBody OntologyContextEnvelope envelope) {
        boolean ok = service.verify(envelope);
        return ApiResponse.success(new VerifyResponse(ok, ok ? "valid" : "invalid or expired"));
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class VerifyResponse {
        private boolean valid;
        private String message;
    }
}
