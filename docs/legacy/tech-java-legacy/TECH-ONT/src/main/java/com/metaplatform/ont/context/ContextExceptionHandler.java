package com.metaplatform.ont.context;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.validation.FieldError;
import java.util.stream.Collectors;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ContextExceptionHandler {
    @ExceptionHandler(ContextException.class)
    public ResponseEntity<OntologyErrorResponse> handle(ContextException ex) {
        return ResponseEntity.status(ex.getStatus()).body(OntologyErrorResponse.builder().errorCode(ex.getErrorCode()).errorMessage(ex.getMessage()).build());
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<OntologyErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream().map(FieldError::getField).collect(Collectors.joining(", "));
        return ResponseEntity.badRequest().body(OntologyErrorResponse.builder().errorCode("INTERACTION_INVALID").errorMessage(msg).build());
    }
}
