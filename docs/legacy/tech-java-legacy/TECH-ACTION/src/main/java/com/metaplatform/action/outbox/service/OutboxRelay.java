package com.metaplatform.action.outbox.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxRelay {

    private final ActionOutboxService actionOutboxService;

    @Scheduled(fixedRateString = "${action.outbox.relay-fixed-rate-ms:5000}")
    public void relay() {
        try {
            int processed = actionOutboxService.relayOnce();
            if (processed > 0) {
                log.debug("Outbox relay processed {} messages", processed);
            }
        } catch (Exception e) {
            log.error("Outbox relay cycle failed", e);
        }
    }
}
