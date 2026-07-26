package com.metaplatform.agent.api;

import jakarta.servlet.http.HttpServletRequest;
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
