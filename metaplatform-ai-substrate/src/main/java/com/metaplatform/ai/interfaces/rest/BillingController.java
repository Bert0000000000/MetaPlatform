package com.metaplatform.ai.interfaces.rest;

import com.metaplatform.ai.billing.TokenBillingService;
import com.metaplatform.ai.interfaces.rest.dto.BillingSummary;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {

    private final TokenBillingService billingService;

    public BillingController(TokenBillingService billingService) {
        this.billingService = billingService;
    }

    @GetMapping("/usage/{tenantId}")
    public ResponseEntity<Map<String, Object>> getUsage(@PathVariable String tenantId) {
        long usage = billingService.getDailyUsage(tenantId);
        return ResponseEntity.ok(Map.of(
                "tenantId", tenantId,
                "dailyUsage", usage
        ));
    }

    @GetMapping("/quota/{tenantId}")
    public ResponseEntity<Map<String, Object>> checkQuota(@PathVariable String tenantId) {
        boolean exceeded = billingService.isQuotaExceeded(tenantId);
        return ResponseEntity.ok(Map.of(
                "tenantId", tenantId,
                "quotaExceeded", exceeded
        ));
    }

    @GetMapping("/summary/{tenantId}")
    public ResponseEntity<BillingSummary> getSummary(@PathVariable String tenantId) {
        TokenBillingService.BillingSummary summary = billingService.getSummary(tenantId);
        return ResponseEntity.ok(new BillingSummary(
                summary.tenantId(),
                summary.date(),
                summary.dailyUsage(),
                summary.dailyQuota(),
                summary.remainingQuota(),
                summary.usageByModel()
        ));
    }
}
