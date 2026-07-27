const fs = require("fs");
const path = "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/TECH-AGENT/src/main/java/com/metaplatform/agent/authoring/AuthoringService.java";
let src = fs.readFileSync(path, "utf8");
const NL = "\r\n";

// 1. Add RAGClient import.
const importOld = "import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest.CandidateInput;";
const importNew = "import com.metaplatform.agent.clients.RAGClient;\n" + importOld;
if (!src.includes(importOld)) throw new Error("importOld not found");
src = src.replace(importOld, importNew);

// 2. Add ragClient field + 2-arg ctor that defaults to null.
const ctorOld = [
  "    private final OntologyDraftService draftService;",
  "",
  "    @Autowired",
  "    public AuthoringService(@Autowired(required = false) OntologyDraftService draftService) {",
  "        this.draftService = draftService;",
  "    }"
].join(NL);
const ctorNew = [
  "    private final OntologyDraftService draftService;",
  "    private final RAGClient ragClient;",
  "",
  "    @Autowired",
  "    public AuthoringService(@Autowired(required = false) OntologyDraftService draftService) {",
  "        this(draftService, null);",
  "    }",
  "",
  "    @Autowired",
  "    public AuthoringService(",
  "            @Autowired(required = false) OntologyDraftService draftService,",
  "            @Autowired(required = false) RAGClient ragClient) {",
  "        this.draftService = draftService;",
  "        this.ragClient = ragClient;",
  "    }"
].join(NL);
if (!src.includes(ctorOld)) throw new Error("ctorOld not found");
src = src.replace(ctorOld, ctorNew);

// 3. Add submitWithRagBackfill method right before the closing brace.
const helperOld = [
  "    private static String stringOr(Object o, String def) {",
  "        return o == null ? def : String.valueOf(o);",
  "    }"
].join(NL);
const helperNew = [
  "    /**",
  "     * P2-RAG-04 - end-to-end authoring with RAG backfill.",
  "     *",
  "     * <p>For every candidate that lacks evidenceRefs, RAG search is triggered using",
  "     * the candidate concept+property (or runId topic) as the query, and the resulting",
  "     * document references are attached as evidence. The draft is then submitted as",
  "     * usual.</p>",
  "     *",
  "     * <p>If no RAGClient is wired, this falls back to {@link #submit(ProposeDraftRequest)}",
  "     * without backfill.</p>",
  "     */",
  "    public OntologyDraftEntity submitWithRagBackfill(ProposeDraftRequest request, int topK) {",
  "        if (ragClient == null) {",
  "            log.warn(\"[AuthoringService] no RAGClient wired; backfill skipped run={}\", request.getRunId());",
  "            return submit(request);",
  "        }",
  "        java.util.List<CandidateInput> originals = request.getCandidates();",
  "        if (originals == null || originals.isEmpty()) return submit(request);",
  "        java.util.List<CandidateInput> backfilled = new java.util.ArrayList<>(originals.size());",
  "        for (CandidateInput c : originals) {",
  "            if (c == null) continue;",
  "            if (c.getEvidenceRefs() != null && !c.getEvidenceRefs().isEmpty()) {",
  "                backfilled.add(c);",
  "                continue;",
  "            }",
  "            String query = buildCandidateQuery(c);",
  "            try {",
  "                java.util.List<java.util.Map<String, Object>> hits = ragClient.search(",
  "                        query, java.util.List.of(), topK,",
  "                        request.getTenantId(), request.getRunId());",
  "                java.util.List<String> refs = new java.util.ArrayList<>();",
  "                for (java.util.Map<String, Object> hit : hits) {",
  "                    if (hit == null) continue;",
  "                    Object src = hit.get(\"source\");",
  "                    Object docId = hit.get(\"id\");",
  "                    if (src != null) refs.add(String.valueOf(src));",
  "                    else if (docId != null) refs.add(String.valueOf(docId));",
  "                }",
  "                c.setEvidenceRefs(refs);",
  "                log.info(\"[AuthoringService] backfill candidate concept={} property={} -> {} refs\",",
  "                        c.getConceptCode(), c.getProperty(), refs.size());",
  "            } catch (Exception e) {",
  "                log.warn(\"[AuthoringService] RAG backfill failed for concept={} property={}: {}\",",
  "                        c.getConceptCode(), c.getProperty(), e.getMessage());",
  "            }",
  "            backfilled.add(c);",
  "        }",
  "        request.setCandidates(backfilled);",
  "        return submit(request);",
  "    }",
  "",
  "    private static String buildCandidateQuery(CandidateInput c) {",
  "        StringBuilder sb = new StringBuilder();",
  "        if (c.getConceptCode() != null) sb.append(c.getConceptCode());",
  "        if (c.getProperty() != null) sb.append(\" \").append(c.getProperty());",
  "        if (c.getProposedValue() != null) sb.append(\" \").append(c.getProposedValue());",
  "        return sb.length() == 0 ? \"unknown\" : sb.toString();",
  "    }",
  "",
  "    private static String stringOr(Object o, String def) {",
  "        return o == null ? def : String.valueOf(o);",
  "    }"
].join(NL);
if (!src.includes(helperOld)) throw new Error("helperOld not found");
src = src.replace(helperOld, helperNew);

fs.writeFileSync(path, src, "utf8");
console.log("AuthoringService wired with RAG backfill");
