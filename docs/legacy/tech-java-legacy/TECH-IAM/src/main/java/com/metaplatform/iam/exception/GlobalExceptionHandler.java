package com.metaplatform.iam.exception;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.TraceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.stream.Collectors;

/**
 * Translates exceptions thrown by controllers / Spring Web into
 * {@link ApiResponse} envelopes with semantically correct HTTP status codes.
 *
 * <p>The catch-all {@link #handleException(Exception)} MUST stay last. All
 * Spring framework exceptions that map to a meaningful 4xx are handled above
 * it; only genuinely unexpected failures reach 500.
 *
 * <p>Codes used:
 * <ul>
 *   <li>40401 {@link ErrorCode#NOT_FOUND} - resource not found</li>
 *   <li>40501 - HTTP method not supported on the route</li>
 *   <li>40001 {@link ErrorCode#INVALID_PARAM} - bad request body / param</li>
 *   <li>41501 - unsupported media type</li>
 *   <li>50001 {@link ErrorCode#INTERNAL_ERROR} - genuine server fault</li>
 * </ul>
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IamException.class)
    public ResponseEntity<ApiResponse<Void>> handleIamException(IamException e) {
        ErrorCode errorCode = e.getErrorCode();
        return ResponseEntity.status(errorCode.getHttpStatus())
                .body(ApiResponse.error(errorCode.getCode(), e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        return ResponseEntity.status(ErrorCode.INVALID_PARAM.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.INVALID_PARAM.getCode(), message));
    }

    // ---- Spring framework exceptions: map to semantically correct 4xx ----

    /** Unmapped URL -> 404 NOT_FOUND (was: 500). */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResource(NoResourceFoundException e) {
        String path = e.getResourcePath() == null ? "" : e.getResourcePath();
        log.debug("No static resource: {}", path);
        return ResponseEntity.status(ErrorCode.NOT_FOUND.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.NOT_FOUND.getCode(),
                        "Resource not found: /" + path));
    }

    /** Wrong HTTP verb on an existing route -> 405 METHOD_NOT_ALLOWED (was: 500). */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        log.debug("Method not supported: {}", e.getMessage());
        return ResponseEntity.status(org.springframework.http.HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiResponse.error(40501,
                        "HTTP method not allowed: " + (e.getMethod() == null ? "" : e.getMethod())));
    }

    /**
     * Query/path param could not be converted (e.g. ?startTime=invalid, bad enum literal).
     * 400 BAD_REQUEST (was: 500).
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        String name = e.getName();
        String required = e.getRequiredType() == null ? "?" : e.getRequiredType().getSimpleName();
        log.debug("Type mismatch on parameter '{}': {}", name, e.getMessage());
        return ResponseEntity.status(ErrorCode.INVALID_PARAM.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.INVALID_PARAM.getCode(),
                        "Invalid value for parameter '" + name + "' (expected " + required + ")"));
    }

    /** Missing required @RequestParam -> 400 (was: 500). */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParam(MissingServletRequestParameterException e) {
        log.debug("Missing parameter: {}", e.getParameterName());
        return ResponseEntity.status(ErrorCode.INVALID_PARAM.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.INVALID_PARAM.getCode(),
                        "Missing required parameter: " + e.getParameterName()));
    }

    /** Malformed JSON body or unreadable request -> 400 (was: 500). */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotReadable(HttpMessageNotReadableException e) {
        log.debug("Message not readable: {}", e.getMessage());
        return ResponseEntity.status(ErrorCode.INVALID_PARAM.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.INVALID_PARAM.getCode(),
                        "Malformed request body"));
    }

    /** Wrong Content-Type / Accept header -> 415 (was: 500). */
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMediaType(HttpMediaTypeNotSupportedException e) {
        log.debug("Media type not supported: {}", e.getMessage());
        return ResponseEntity.status(org.springframework.http.HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(ApiResponse.error(41501, "Unsupported media type"));
    }

    // ---- Genuine fallback: MUST stay last. ----

    /**
     * Catch-all for unexpected runtime failures. Logs the stack with the traceId
     * so it can be cross-referenced with the {@link TraceContext} returned to the
     * caller. Surfaces as 500 INTERNAL_ERROR.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("Unexpected error, traceId={}", TraceContext.getOrCreate(), e);
        return ResponseEntity.status(ErrorCode.INTERNAL_ERROR.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.INTERNAL_ERROR.getCode(), ErrorCode.INTERNAL_ERROR.getMessage()));
    }
}