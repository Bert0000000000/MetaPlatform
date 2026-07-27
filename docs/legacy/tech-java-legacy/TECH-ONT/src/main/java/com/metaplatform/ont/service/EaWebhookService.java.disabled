package com.metaplatform.ont.service;

import com.metaplatform.ont.common.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class EaWebhookService {

    private final WebClient eaWebClient;

    public void notifyConceptChange(String conceptId, String conceptCode, String conceptName,
                                    String changeType, Map<String, Object> payload) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("conceptId", conceptId);
            body.put("conceptCode", conceptCode);
            body.put("conceptName", conceptName);
            body.put("changeType", changeType);
            body.put("payload", payload != null ? payload : Map.of());

            eaWebClient.post()
                    .uri("/api/v1/ea/ontology-mappings/webhook")
                    .header("X-Tenant-Id", TenantContext.get())
                    .bodyValue(body)
                    .retrieve()
                    .toBodilessEntity()
                    .subscribe();
        } catch (Exception e) {
            log.warn("Failed to notify EA webhook for concept {} change {}", conceptId, changeType, e);
        }
    }
}
