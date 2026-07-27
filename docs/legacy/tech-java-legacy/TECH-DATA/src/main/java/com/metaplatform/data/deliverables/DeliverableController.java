package com.metaplatform.data.deliverables;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.deliverables.dto.CreateDeliverableRequest;
import com.metaplatform.data.deliverables.dto.DeliverableResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * 交付物端点。
 *
 * <p>对应 Python app/api/v1/deliverables.py（5 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/deliverables")
@RequiredArgsConstructor
public class DeliverableController {

    private final DeliverableService deliverableService;

    @PostMapping
    public ApiResponse<DeliverableResponse> create(@Valid @RequestBody CreateDeliverableRequest request) {
        return ApiResponse.success(deliverableService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<DeliverableResponse>> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String source,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(deliverableService.list(type, source, page, pageSize));
    }

    @GetMapping("/{deliverableId}")
    public ApiResponse<DeliverableResponse> get(@PathVariable String deliverableId) {
        return ApiResponse.success(deliverableService.get(deliverableId));
    }

    @GetMapping("/{deliverableId}/download")
    public ResponseEntity<byte[]> download(@PathVariable String deliverableId) {
        String url = deliverableService.getDownloadUrl(deliverableId);
        String content = "deliverable content stub for " + deliverableId;
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"deliverable-" + deliverableId + ".bin\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(content.getBytes(StandardCharsets.UTF_8));
    }

    @DeleteMapping("/{deliverableId}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String deliverableId) {
        boolean ok = deliverableService.delete(deliverableId);
        return ApiResponse.success(Map.of("deleted", ok, "deliverableId", deliverableId));
    }
}
