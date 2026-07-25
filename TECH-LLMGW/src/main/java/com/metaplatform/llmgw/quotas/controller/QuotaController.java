package com.metaplatform.llmgw.quotas.controller;

import com.metaplatform.llmgw.common.ApiResponse;
import com.metaplatform.llmgw.quotas.dto.CreateQuotaRequest;
import com.metaplatform.llmgw.quotas.dto.QuotaDto;
import com.metaplatform.llmgw.quotas.service.QuotaService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/llmgw/quotas")
@RequiredArgsConstructor
public class QuotaController {

    private final QuotaService quotaService;

    @GetMapping
    public ApiResponse<Page<QuotaDto>> list(Pageable pageable) {
        return ApiResponse.ok(quotaService.listAll(pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<QuotaDto> getById(@PathVariable Long id) {
        return ApiResponse.ok(quotaService.getById(id));
    }

    @PostMapping
    public ApiResponse<QuotaDto> create(@RequestBody CreateQuotaRequest request) {
        return ApiResponse.ok(quotaService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<QuotaDto> update(@PathVariable Long id, @RequestBody CreateQuotaRequest request) {
        return ApiResponse.ok(quotaService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        quotaService.delete(id);
        return ApiResponse.ok(null);
    }
}
