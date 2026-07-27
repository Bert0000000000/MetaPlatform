package com.metaplatform.rule.service;

import com.metaplatform.rule.exception.RuleException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OntologyReferenceValidatorTest {

    @Mock
    private WebClient webClient;

    @Mock
    private WebClient.RequestHeadersUriSpec<?> uriSpec;

    @Mock
    private WebClient.RequestHeadersSpec<?> headersSpec;

    @Mock
    private WebClient.ResponseSpec responseSpec;

    private OntologyReferenceValidator validator;

    @BeforeEach
    void setUp() {
        validator = new OntologyReferenceValidator(webClient);
    }

    @Test
    void validate_shouldPass_whenNoOntologyReferences() {
        // Expression without concept.attribute references
        assertThatCode(() -> validator.validate("amount >= 100000"))
                .doesNotThrowAnyException();
    }

    @Test
    void validate_shouldPass_whenSimpleComparison() {
        // Another expression without references
        assertThatCode(() -> validator.validate("tags != null and tags.contains('VIP')"))
                .doesNotThrowAnyException();
    }

    @Test
    void validate_shouldThrow_whenConceptNotExists() {
        // WebClient returns 404 for concept "Customer"
        // doReturn bypasses generic wildcard type checking
        doReturn(uriSpec).when(webClient).get();
        doReturn(headersSpec).when(uriSpec).uri(anyString(), any(Object[].class));
        doReturn(responseSpec).when(headersSpec).retrieve();
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.error(
                new WebClientResponseException(404, "Not Found", null, new byte[0], StandardCharsets.UTF_8)));

        assertThatThrownBy(() -> validator.validate("Customer.amount >= 100000"))
                .isInstanceOf(RuleException.class)
                .hasMessageContaining("概念 Customer 不存在");
    }

    @Test
    void parseReferences_shouldExtractConceptAttributePairs() {
        var refs = validator.parseReferences("Customer.amount >= 100000 and Customer.tags.contains('VIP')");

        assertThat(refs).hasSize(1);
        assertThat(refs.get("Customer")).containsExactlyInAnyOrder("amount", "tags");
    }
}
