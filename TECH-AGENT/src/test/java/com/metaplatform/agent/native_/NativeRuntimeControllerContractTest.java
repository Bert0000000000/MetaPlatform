package com.metaplatform.agent.native_;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.metaplatform.agent.context.OntologyContextEnvelopeSigner;
import com.metaplatform.agent.runtime.UnifiedRuntimeResponse;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;

import java.util.Map;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class NativeRuntimeControllerContractTest {
    @Test
    void rejectsMissingContextBeforeRuntime() {
        var runtime = Mockito.mock(NativeAgentRuntime.class);
        var controller = new NativeRuntimeController(runtime, new ObjectMapper(), Mockito.mock(OntologyContextEnvelopeSigner.class));
        var response = controller.run(new NativeRunRequest());
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Mockito.verifyNoInteractions(runtime);
    }

    @Test
    void responseContractHasStableCollections() {
        var response = new UnifiedRuntimeResponse("r1", "FAILED", "bad", null, null, null, null);
        assertNotNull(response.claims());
        assertNotNull(response.evidence());
        assertNotNull(response.events());
        assertNotNull(response.metadata());
        assertFalse(response.successful());
    }
    @Test
    void acceptsMatchingSignedContext() {
        var runtime = Mockito.mock(NativeAgentRuntime.class);
        var signer = Mockito.mock(OntologyContextEnvelopeSigner.class);
        Mockito.when(runtime.execute(Mockito.any(), Mockito.any())).thenReturn(NativeAgentRuntime.RunOutcome.success("ok"));
        var controller = new NativeRuntimeController(runtime, new ObjectMapper().registerModule(new JavaTimeModule()), signer);
        var envelope = new java.util.LinkedHashMap<String, Object>();
        envelope.put("envelopeId", "e1"); envelope.put("tenantId", "t1"); envelope.put("userId", "u1"); envelope.put("runId", "r1");
        envelope.put("subject", Map.of("conceptCode", "Customer", "objectId", "c1")); envelope.put("ontologyVersion", "v1");
        envelope.put("schema", Map.of()); envelope.put("metrics", List.of()); envelope.put("allowedTools", List.of()); envelope.put("allowedActions", List.of());
        envelope.put("dataScopes", Map.of()); envelope.put("permissionSnapshotId", "p1"); envelope.put("expiresAt", "2099-01-01T00:00:00Z");
        envelope.put("signature", "sig"); envelope.put("contractVersion", "1.0");
        var request = new NativeRunRequest();
        request.setContext(Map.of("tenantId", "t1", "userId", "u1", "runId", "r1", "userMessage", "hello", "ontologyContext", envelope));
        var response = controller.run(request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Mockito.verify(signer).verify(Mockito.any());
        Mockito.verify(runtime).execute(Mockito.any(), Mockito.any());
    }

}

