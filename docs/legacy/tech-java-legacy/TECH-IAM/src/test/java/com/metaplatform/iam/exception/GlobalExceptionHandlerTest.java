package com.metaplatform.iam.exception;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the {@link GlobalExceptionHandler} status-code mapping. The catch-all
 * previously swallowed Spring framework exceptions as 500; this test guards
 * against regression for the cases that surfaced in the admin module's 500.
 *
 * <p>Each test invokes the specific @ExceptionHandler method directly so the
 * behaviour matches what Spring would do at runtime. The catch-all is exercised
 * separately by {@link #shouldMap_GenuinelyUnexpected_to_500()}.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void shouldMap_NoResourceFound_to_404() {
        // Equivalent to "GET /api/v1/iam/users/me/permissions" hitting an unmapped path.
        NoResourceFoundException ex = new NoResourceFoundException(
                org.springframework.http.HttpMethod.GET,
                "api/v1/iam/users/me/permissions");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleNoResource(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getCode()).isEqualTo(40401);
    }

    @Test
    void shouldMap_MethodNotSupported_to_405() {
        // Equivalent to sending GET against a PATCH-only endpoint like /users/{id}/status.
        HttpRequestMethodNotSupportedException ex =
                new HttpRequestMethodNotSupportedException("GET");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleMethodNotSupported(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getCode()).isEqualTo(40501);
    }

    @Test
    void shouldMap_TypeMismatch_to_400() {
        // Equivalent to ?startTime=invalid throwing DateTimeParseException via Instant binding.
        MethodArgumentTypeMismatchException ex = new MethodArgumentTypeMismatchException(
                "not-a-date", java.time.Instant.class, "startTime",
                null, new java.time.format.DateTimeParseException("bad", "not-a-date", 0));

        ResponseEntity<ApiResponse<Void>> resp = handler.handleTypeMismatch(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getCode()).isEqualTo(40001);
    }

    @Test
    void shouldMap_MissingParam_to_400() {
        MissingServletRequestParameterException ex =
                new MissingServletRequestParameterException("userId", "String");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleMissingParam(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getCode()).isEqualTo(40001);
    }

    @Test
    void shouldMap_MediaTypeNotSupported_to_415() {
        HttpMediaTypeNotSupportedException ex =
                new HttpMediaTypeNotSupportedException("application/xml");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleMediaType(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getCode()).isEqualTo(41501);
    }

    @Test
    void shouldMap_MessageNotReadable_to_400() {
        // Body parse failure (e.g. malformed JSON or wrong enum value in request).
        HttpMessageNotReadableException ex = new HttpMessageNotReadableException("bad json");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleNotReadable(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getCode()).isEqualTo(40001);
    }

    @Test
    void shouldMap_GenuinelyUnexpected_to_500() {
        // A truly unexpected runtime error must still surface as 500.
        IllegalStateException ex = new IllegalStateException("kaboom");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleException(ex);

        assertThat(resp.getStatusCode()).isEqualTo(ErrorCode.INTERNAL_ERROR.getHttpStatus());
        assertThat(resp.getBody().getCode()).isEqualTo(ErrorCode.INTERNAL_ERROR.getCode());
    }
}