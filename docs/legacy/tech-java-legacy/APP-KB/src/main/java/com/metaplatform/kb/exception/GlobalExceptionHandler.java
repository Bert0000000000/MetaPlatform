package com.metaplatform.kb.exception;

import com.metaplatform.kb.dto.ErrorResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClientException;

@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(WebClientException.class)
    public ResponseEntity<ErrorResponse> handleWebClient(WebClientException ex) { return ResponseEntity.status(502).body(new ErrorResponse("UPSTREAM_ERROR", ex.getMessage())); }
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleState(IllegalStateException ex) { return ResponseEntity.badRequest().body(new ErrorResponse("INVALID_STATE", ex.getMessage())); }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) { return ResponseEntity.status(500).body(new ErrorResponse("INTERNAL_ERROR", ex.getMessage())); }
}
