# 5-scenario static audit
$ErrorActionPreference = "Continue"
$base = $PSScriptRoot
$repoRoot = (Get-Item "$base/../..").FullName
Set-Location $repoRoot
$results = @()
function Check {
    param($id, $title, [scriptblock]$test)
    $r = & $test
    $script:results += [PSCustomObject]@{ Id = $id; Title = $title; Status = if ($r) { "PASS" } else { "FAIL" } }
}
Check "A.Envelope.Valid" "Envelope TTL+deniedFields" {
    (Get-Content "TECH-ONT/src/main/java/com/metaplatform/ont/context/OntologyContextEnvelope.java" -Raw) -match "expiresAt"
}
Check "A.Middleware.Order" "5 MW order 100..500" {
    $orders = @()
    Get-ChildItem "TECH-AGENT/src/main/java/com/metaplatform/agent/middleware" -Filter "*.java" | ForEach-Object {
        $c = Get-Content $_.FullName -Raw
        if ($c -match "public int order\(\)\s*\{ return (\d+);") { $orders += [int]$Matches[1] }
    }
    ($orders | Sort-Object) -join "," -eq "100,200,300,400,500"
}
Check "A.Grounding.Concept" "Grounding MW Concept" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/middleware/OntologyGroundingMiddleware.java" -Raw) -match "detectConcepts"
}
Check "A.Permission.Gate" "Permission MW Gate" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/middleware/OntologyPermissionMiddleware.java" -Raw) -match "allowedTools"
}
Check "A.Evidence.Bind" "Evidence MW Bind" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/middleware/OntologyEvidenceMiddleware.java" -Raw) -match "extractEvidence"
}
Check "A.ActionGuard.Mark" "ActionGuard MW Mark" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/middleware/OntologyActionGuardMiddleware.java" -Raw) -match "requiresApproval"
}
Check "A.Router.Split" "RuntimeRouter Fast/Deep" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/runtime/RuntimeRouter.java" -Raw) -match "RouteDecision\."
}
Check "A.Mock.Cust10086" "Mock CUST-10086 4 classes" {
    $j = Get-Content "docs/scenarios/mock-data/customer-cust-10086.json" -Raw | ConvertFrom-Json
    ($j.relatedObjects.PSObject.Properties.Name -contains "HAS_ORDER")
}
Check "B.SubAgent.Trim" "SubAgent Trim" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/subagent/SubAgentContextBuilder.java" -Raw) -match "filterByConcepts"
}
Check "B.MCP.Tools" "MCP Tools" {
    $c = Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/mcp/OnboardingMcpServer.java" -Raw
    ([regex]::Matches($c, "tools.add\(tool\(")).Count -ge 20
}
Check "B.Router.Deep" "Router Deep" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/runtime/RuntimeRouter.java" -Raw) -match "msg.length\(\) > 200"
}
Check "B.Mock.SubAgents" "Mock 3 SubAgents" {
    $j = Get-Content "docs/scenarios/mock-data/sales-decline-east-china.json" -Raw | ConvertFrom-Json
    $j.expectedSubAgents.Count -eq 3
}
Check "C.Policy.YAML" "action-policies.yaml 4 Action" {
    $y = Get-Content "TECH-ACTION/src/main/resources/action-policies.yaml" -Raw
    ($y -match "CreateFollowUpTask") -and ($y -match "RequestDiscount")
}
Check "C.Service.Propose" "ActionProposalService.decide" {
    (Get-Content "TECH-ACTION/src/main/java/com/metaplatform/action/proposal/ActionProposalService.java" -Raw) -match "policyService.decide"
}
Check "C.Idempotency" "ActionProposal idem" {
    (Get-Content "TECH-ACTION/src/main/java/com/metaplatform/action/proposal/ActionProposalRepository.java" -Raw) -match "findByTenantIdAndIdempotencyKey"
}
Check "C.Audit.OnExecute" "Action Audit Event = ontology.action.executed" {
    $c = Get-Content "TECH-ACTION/src/main/java/com/metaplatform/action/proposal/TopologyEvents.java" -Raw
    ($c -match "ontology\.action\.executed")
}
Check "D.Trigger.Listener" "TriggerEngine Listener" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/trigger/TriggerEngine.java" -Raw) -match "@EventTopicListener"
}
Check "D.Trigger.Filter" "TriggerEngine Filter" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/trigger/TriggerEngine.java" -Raw) -match "private boolean match"
}
Check "D.Trigger.Cooldown" "Trigger Cooldown" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/trigger/TriggerEntity.java" -Raw) -match "cooldownSec"
}
Check "D.Mock.Contract" "Mock Contract.expiring" {
    $j = Get-Content "docs/scenarios/mock-data/contract-expiring-event.json" -Raw | ConvertFrom-Json
    ($j.eventCode -eq "Contract.expiring") -and ($j.payload.daysToExpiry -le 45)
}
Check "E.Extraction.Sub" "Extraction Trigger" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/extraction/DocumentExtractionTrigger.java" -Raw) -match "DOCUMENT_UPLOADED"
}
Check "E.Candidate.Listener" "Candidate Listener" {
    (Get-Content "TECH-AGENT/src/main/java/com/metaplatform/agent/extraction/DocumentCandidateListener.java" -Raw) -match "DOCUMENT_CANDIDATE_READY"
}
Check "E.Draft.Service" "Draft Service" {
    (Get-Content "TECH-ONT/src/main/java/com/metaplatform/ont/draft/OntologyDraftService.java" -Raw) -match "proposeDraft"
}
Check "E.Validator.Rules" "Validator Rules" {
    (Get-Content "TECH-ONT/src/main/java/com/metaplatform/ont/draft/OntologyValidator.java" -Raw) -match "validateDraft"
}
Check "E.Commit.Event" "Commit Event" {
    (Get-Content "TECH-ONT/src/main/java/com/metaplatform/ont/draft/OntologyDraftService.java" -Raw) -match "ONTOLOGY_COMMIT_PUBLISHED"
}
Check "E.Mock.Docs" "Mock 3 Docs" {
    $j = Get-Content "docs/scenarios/mock-data/knowledge-documents.json" -Raw | ConvertFrom-Json
    $j.documents.Count -eq 3
}
Write-Host ""
Write-Host "================================================="
$pass = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$fail = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$results | ForEach-Object {
    $icon = if ($_.Status -eq "PASS") { "[PASS]" } else { "[FAIL]" }
    Write-Host ("  {0,-7} {1,-24} {2}" -f $icon, $_.Id, $_.Title)
}
Write-Host ""
Write-Host ("  Pass: {0}/{1}   Fail: {2}" -f $pass, $results.Count, $fail)
