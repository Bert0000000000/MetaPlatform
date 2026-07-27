package com.metaplatform.action.integration.ont;

import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.exception.ActionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class OntologyIntegrationService {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final WebClient.Builder webClientBuilder;

    @Value("${action.integration.ont.base-url:http://localhost:8201}")
    private String ontBaseUrl;

    /**
     * 校验本体实体是否存在。
     *
     * <p>收紧空值校验逻辑：</p>
     * <ul>
     *   <li>entityId 为空且 {@code required=true} → 抛 {@link ErrorCode#MISSING_REQUIRED_FIELD}</li>
     *   <li>entityId 为空且 {@code required=false} → 跳过校验（可选绑定）</li>
     *   <li>entityId 非空 → 必须校验存在性，不存在抛 {@link ErrorCode#NOT_FOUND}，
     *       TECH-ONT 不可用抛 {@link ErrorCode#DEPENDENCY_ERROR}</li>
     * </ul>
     *
     * @param entityId 本体实体 ID
     * @param required 是否必填
     */
    public void validateEntity(String entityId, boolean required) {
        if (entityId == null || entityId.isBlank()) {
            if (required) {
                throw new ActionException(ErrorCode.MISSING_REQUIRED_FIELD,
                        "entityId 不能为空（必填绑定）");
            }
            return;
        }
        try {
            String response = client()
                    .get()
                    .uri("/api/v1/ont/entities/{id}", entityId)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
            if (response == null || response.isBlank()) {
                throw new ActionException(ErrorCode.NOT_FOUND,
                        "本体实体不存在: " + entityId);
            }
        } catch (ActionException e) {
            throw e;
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                throw new ActionException(ErrorCode.NOT_FOUND,
                        "本体实体不存在: " + entityId);
            }
            log.error("TECH-ONT returned error for entity {}", entityId, e);
            throw new ActionException(ErrorCode.DEPENDENCY_ERROR,
                    "TECH-ONT 实体校验失败: " + e.getStatusCode());
        } catch (Exception e) {
            log.error("Failed to validate ontology entity {} via TECH-ONT", entityId, e);
            throw new ActionException(ErrorCode.DEPENDENCY_ERROR,
                    "TECH-ONT 实体校验失败: " + e.getMessage());
        }
    }

    private WebClient client() {
        return webClientBuilder.clone().baseUrl(ontBaseUrl).build();
    }
}
