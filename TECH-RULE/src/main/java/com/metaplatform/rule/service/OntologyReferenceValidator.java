package com.metaplatform.rule.service;

import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.exception.RuleException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class OntologyReferenceValidator {

    private final WebClient ontologyWebClient;

    private static final Pattern CONCEPT_ATTRIBUTE_PATTERN =
            Pattern.compile("\\b([A-Z][A-Za-z0-9_]*)\\.([a-z][A-Za-z0-9_]*)");

    public OntologyReferenceValidator(@Qualifier("ontologyWebClient") WebClient ontologyWebClient) {
        this.ontologyWebClient = ontologyWebClient;
    }

    /**
     * 校验条件表达式中的本体引用是否合法。
     * 解析表达式中的 Concept.attribute 模式，调用 TECH-ONT API 验证概念和属性是否存在。
     *
     * @param conditionExpr 条件表达式，如 "Customer.amount >= 100000" 或 "amount >= 100000"
     */
    public void validate(String conditionExpr) {
        Map<String, Set<String>> references = parseReferences(conditionExpr);
        if (references.isEmpty()) {
            return;
        }

        for (Map.Entry<String, Set<String>> entry : references.entrySet()) {
            String conceptCode = entry.getKey();
            if (!conceptExists(conceptCode)) {
                throw new RuleException(ErrorCode.ONTOLOGY_REFERENCE_INVALID,
                        "本体引用校验失败：概念 " + conceptCode + " 不存在");
            }
            Set<String> attributes = entry.getValue();
            if (!attributes.isEmpty()) {
                Set<String> validAttributes = getConceptAttributes(conceptCode);
                for (String attr : attributes) {
                    if (!validAttributes.contains(attr)) {
                        throw new RuleException(ErrorCode.ONTOLOGY_REFERENCE_INVALID,
                                "本体引用校验失败：概念 " + conceptCode + " 不存在属性 " + attr);
                    }
                }
            }
        }
    }

    /**
     * 解析条件表达式中的本体引用。
     * 匹配 Concept.attribute 模式（概念以大写字母开头，属性以小写字母开头）。
     */
    Map<String, Set<String>> parseReferences(String conditionExpr) {
        Map<String, Set<String>> references = new HashMap<>();
        if (conditionExpr == null || conditionExpr.isBlank()) {
            return references;
        }
        Matcher matcher = CONCEPT_ATTRIBUTE_PATTERN.matcher(conditionExpr);
        while (matcher.find()) {
            String conceptCode = matcher.group(1);
            String attributeCode = matcher.group(2);
            references.computeIfAbsent(conceptCode, k -> new LinkedHashSet<>()).add(attributeCode);
        }
        return references;
    }

    private boolean conceptExists(String conceptCode) {
        try {
            String body = ontologyWebClient.get()
                    .uri("/api/v1/ont/concepts/{code}", conceptCode)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return body != null && !body.isBlank();
        } catch (WebClientResponseException e) {
            log.warn("Concept {} not found in ONT service: {}", conceptCode, e.getStatusCode());
            return false;
        } catch (Exception e) {
            log.warn("Failed to validate concept {} via ONT service: {}", conceptCode, e.getMessage());
            return false;
        }
    }

    private Set<String> getConceptAttributes(String conceptCode) {
        try {
            String body = ontologyWebClient.get()
                    .uri("/api/v1/ont/concepts/{code}/attributes", conceptCode)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            if (body == null || body.isBlank()) {
                return new HashSet<>();
            }
            return extractAttributeCodes(body);
        } catch (WebClientResponseException e) {
            log.warn("Attributes for concept {} not found in ONT service: {}", conceptCode, e.getStatusCode());
            return new HashSet<>();
        } catch (Exception e) {
            log.warn("Failed to get attributes for concept {} via ONT service: {}", conceptCode, e.getMessage());
            return new HashSet<>();
        }
    }

    /**
     * 从 ONT API 返回的 JSON 中提取属性 code 列表。
     * 简单实现：用正则匹配 "code":"xxx" 模式。
     */
    private Set<String> extractAttributeCodes(String jsonBody) {
        Set<String> codes = new HashSet<>();
        Pattern codePattern = Pattern.compile("\"code\"\\s*:\\s*\"([^\"]+)\"");
        Matcher matcher = codePattern.matcher(jsonBody);
        while (matcher.find()) {
            codes.add(matcher.group(1));
        }
        return codes;
    }
}
