package com.metaplatform.process.api;

import com.metaplatform.process.infrastructure.exception.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "NOT_FOUND", "message", e.getMessage()));
    }

    @ExceptionHandler(ProcessEngineException.class)
    public ResponseEntity<Map<String, Object>> handleEngineError(ProcessEngineException e) {
        log.error("Process engine error: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "PROCESS_ENGINE_ERROR", "message", e.getMessage()));
    }

    @ExceptionHandler(DslParseException.class)
    public ResponseEntity<Map<String, Object>> handleDslParseError(DslParseException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "DSL_PARSE_ERROR", "message", e.getMessage()));
    }

    @ExceptionHandler(ParticipantResolutionException.class)
    public ResponseEntity<Map<String, Object>> handleParticipantError(ParticipantResolutionException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "PARTICIPANT_RESOLUTION_ERROR", "message", e.getMessage()));
    }

    @ExceptionHandler(NlGenerationException.class)
    public ResponseEntity<Map<String, Object>> handleNlGenError(NlGenerationException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "NL_GENERATION_ERROR", "message", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fieldErrors = new HashMap<>();
        e.getBindingResult().getFieldErrors().forEach(err ->
            fieldErrors.put(err.getField(), err.getDefaultMessage()));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "VALIDATION_ERROR", "fields", fieldErrors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception e) {
        log.error("Unexpected error: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", "INTERNAL_ERROR", "message", "An unexpected error occurred"));
    }
}
