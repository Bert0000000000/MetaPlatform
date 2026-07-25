package com.metaplatform.copilot.controller;

import com.metaplatform.copilot.entity.SchedulingRecordEntity;
import com.metaplatform.copilot.service.SchedulingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/copilot/scheduling")
@RequiredArgsConstructor
public class SchedulingController {
    private final SchedulingService service;

    @GetMapping("/records")
    public Page<SchedulingRecordEntity> list(@RequestParam String userId,
                                              @RequestParam(required = false) String status,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "20") int size) {
        return service.listRecords(userId, status, page, size);
    }

    @GetMapping("/records/{recordId}")
    public SchedulingRecordEntity get(@PathVariable String recordId) {
        return service.getSchedulingRecord(recordId);
    }

    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestParam String userId,
                                     @RequestParam(defaultValue = "7") int days) {
        return service.getStats(userId, days);
    }
}