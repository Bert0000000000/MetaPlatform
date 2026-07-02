package com.metaplatform.ragmdm.api;

import com.metaplatform.ragmdm.api.dto.MdmUpsertRequest;
import com.metaplatform.ragmdm.domain.GoldenRecord;
import com.metaplatform.ragmdm.mdm.MdmService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/mdm/golden-records")
@RequiredArgsConstructor
public class MdmController {

    private final MdmService mdmService;

    @GetMapping
    public Page<GoldenRecord> list(
            @RequestParam(required = false) String entityType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return mdmService.list(entityType, PageRequest.of(page, size));
    }

    @GetMapping("/{id}")
    public MdmService.GoldenRecordDetail getDetail(@PathVariable Long id) {
        return mdmService.getDetail(id);
    }

    @PostMapping("/upsert")
    public GoldenRecord upsert(@Valid @RequestBody MdmUpsertRequest request) {
        return mdmService.upsert(
            request.getEntityType(),
            request.getSourceSystem(),
            request.getSourceId(),
            request.getSourceData()
        );
    }
}
