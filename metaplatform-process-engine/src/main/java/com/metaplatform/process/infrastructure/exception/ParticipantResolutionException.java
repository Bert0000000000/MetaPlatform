package com.metaplatform.process.infrastructure.exception;

public class ParticipantResolutionException extends RuntimeException {
    public ParticipantResolutionException(String message) {
        super(message);
    }

    public ParticipantResolutionException(String message, Throwable cause) {
        super(message, cause);
    }
}
