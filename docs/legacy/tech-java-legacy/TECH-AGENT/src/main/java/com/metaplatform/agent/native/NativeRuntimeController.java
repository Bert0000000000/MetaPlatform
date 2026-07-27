package com.metaplatform.agent.native_;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.middleware.MiddlewareContext;
import com.metaplatform.agent.context.OntologyContextEnvelopeSigner;
import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.runtime.UnifiedRuntimeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/agent/native") @RequiredArgsConstructor
public class NativeRuntimeController {
 private final NativeAgentRuntime runtime; private final ObjectMapper objectMapper;
 private final OntologyContextEnvelopeSigner signer;
 @PostMapping("/runs") public ResponseEntity<UnifiedRuntimeResponse> run(@RequestBody NativeRunRequest request) {
  if (request == null || request.getContext() == null) return ResponseEntity.badRequest().build();
  MiddlewareContext context=objectMapper.convertValue(request.getContext(),MiddlewareContext.class);
  if (context.getOntologyContext() == null || context.getTenantId() == null
      || !context.getTenantId().equals(context.getOntologyContext().tenantId())
      || !context.getRunId().equals(context.getOntologyContext().runId())) {
   return ResponseEntity.badRequest().build();
  }
  try { signer.verify(context.getOntologyContext()); }
  catch (IllegalArgumentException ex) { return ResponseEntity.status(403).build(); }
  String requestTenant = TenantContext.getTenantIdOrDefault();
  if (!"tenant-default".equals(requestTenant) && !requestTenant.equals(context.getTenantId())) {
   return ResponseEntity.status(403).build();
  }
  var outcome=runtime.execute(context,request.getToolCalls());
  return ResponseEntity.ok(new UnifiedRuntimeResponse(context.getRunId(),outcome.status(),outcome.content(),context.getClaims(),java.util.List.of(),java.util.List.of(),java.util.Map.of("runtime","native")));
 }
}

