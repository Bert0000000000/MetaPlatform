package com.metaplatform.ont.context;

import lombok.*;
import java.time.Instant;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EnvelopeHandle {
    private String envelopeId;
    private OntologyContextEnvelope.EnvelopeSignature signature;
    private Instant expiresAt;
}
