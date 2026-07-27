package com.metaplatform.agent.api;

import jakarta.servlet.http.HttpServletRequest;
import com.metaplatform.agent.deerflow.DeerFlowException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class Phase1ExceptionHandler {
    @ExceptionHandler(Phase1Exception.class)
    public ResponseEntity<ErrorResponse> handle(Phase1Exception ex) {
        return ResponseEntity.status(ex.getStatus()).body(ErrorResponse.builder()
                .errorCode(ex.getErrorCode()).errorMessage(ex.getMessage())
                .retryAfterSeconds(ex.getRetryAfterSeconds()).userActionHint(ex.getUserActionHint()).build());
    }

    @ExceptionHandler(DeerFlowException.class)
    public ResponseEntity<ErrorResponse> handleDeerFlow(DeerFlowException ex) {
        int status = ex.getStatus() != null && ex.getStatus() >= 400 && ex.getStatus() < 500
                && ("ENVELOPE_REQUIRED".equals(ex.getCode()) || "DEERFLOW_INVALID_REQUEST".equals(ex.getCode()))
                ? ex.getStatus() : 503;
        return ResponseEntity.status(status).body(ErrorResponse.builder()
                .errorCode(ex.getCode()).errorMessage(ex.getMessage())
                .userActionHint(status == 503 ? "Retry after DeerFlow health recovers" : "Correct the request context")
                .build());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        return ResponseEntity.badRequest().body(ErrorResponse.builder()
                .errorCode("INVALID_REQUEST").errorMessage("Request validation failed").build());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body(ErrorResponse.builder()
                .errorCode("INVALID_REQUEST").errorMessage("Malformed JSON request").build());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(ErrorResponse.builder()
                .errorCode("INVALID_REQUEST").errorMessage(ex.getMessage()).build());
    }
}
