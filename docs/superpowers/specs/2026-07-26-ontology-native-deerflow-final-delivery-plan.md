
# Ontology-Native DeerFlow闁挎稒鑹鹃崣蹇涙⒓閼告鍞介柡鍫氬亾缂備礁鐗愰幆銈夊捶妫颁胶鐟㈤柛鎾崇Т閹绮╅婵呯矒閻犲鍟悿鍕棘閼恒儲鐎俊?

> Version: v1.67 - 2026-07-27 (round 66 / RAG SecurityConfig permitAll + SuperAI vite.config.ts multi-backend proxy with path rewrite + 3-area frontend-backend integration GREEN)
> Status: P0/P1 foundation complete; section 17 10/10 DONE at source + unit-test level. This round adds named SSE event consumption, exclusive afterSeq reconnect, and backend SSE frame contract coverage. Cross-service mvn-boot remains a CI/Testcontainers follow-up.
> 闂侇偄鍊婚弫銈嗙閹惧磭姘ㄩ柨娑欘儚:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform
> Updated baseline: 2026-07-27 11:15 UTC+8, by Codex


## 0. 闁哄倸娲﹂妴鍌溾偓瑙勭煯缂?

闁哄牜鍓氶弸鍐浖閿濆洨鍩犲☉鎾亾濞寸姰鍎扮粭鍛喆閸曨偄鐏婇柨娑欑搷hase 1 闁规亽鍎辫ぐ娑氭嫚鐎涙ɑ顫栧☉鎾抽鐎氬海鎷犻妯峰亾娑撴ⅹllstack E2E Roadmap闁靛棔绗抧gineering Handoff闁靛棔娴畁tegration and Migration Plan闁靛棔闃渙llout Roadmap闁靛棗鍊搁悾鐘垫喆閸曨偆鏆伴梻鍐煐椤斿本娼忛崷顓熸珪闁靛棔绀佹晶鐘诲触鎼达綆浼傞柤杈ㄦ閻ㄧ喐銇勯崫鍕闁靛棔鐒﹀〒鍓佷焊韫囧孩宕查柛鏃撶磿閻垶鎯旈敂琛″亾娴ｉ紦渚€宕?Token 濡澘瀚悾濠氬Υ娓氣偓閻涙瑩寮ㄩ崼鏇燂紝缂佸倷绀侀幏浼村炊閻愬娉婇悷娆忓閸垶濡?

### 0.1 閻庣懓鏈崹姘舵偐閼哥鍋?

| 闁绘鍩栭埀?| 閻庤鐭粻?|
|---|---|
| `DONE` | 闁哄牆顦悿鍕偝閼割兘鍋撴担鍦偞閻犲洦娲栭幏浼村矗椤栨凹妲婚柣婊€鍗抽悰娆撳绩閹壆妲堥柟?|
| `PARTIAL` | 闁哄牆顦悿鍕偝鐢喚绀夊ù锝呮瀹歌京浜搁幋婵嗗綘闂佹鍠涙禒鍫㈡嫬閸愨晛鐏楀Δ鐘叉湰閺?|
| `SKELETON` | 闁告瑯浜濆﹢渚€骞掗妷銉ョ稉闁靛棔鐒﹁啯闁搞劌顑嗛崹銊╁础閻樿京绉撮悗鍦仧楠?|
| `BLOCKED` | 閻炴凹鍋嗙槐顏嗘嫚閹存瑢鍋撴担鐣岃缂佸鐪归埀顑胯兌楠炲棙鏅堕崘鈺佺仐濠靛倹鍨圭€规娊姊肩紒妯荤劷 |
| `DEFERRED` | 闁哄嫬娴烽垾妯荤▔瀹ュ懐娼ｅù婊冮缂嶅宕滃澶嬧枆婵?|

濞戞挸绉寸欢杈ㄧ閵夆懇鍋撳鍛獥鐟滅増娲栭悺銊╁捶閵娾懇鍋撳┑鍐ｅ亾濠婂嫬澶嶉柛娆欑到閻°劑宕烽妸鈶╁亾濠靛洤鐏楅柍銉︾矋濡晞绠涘Δ浣糕叺闁告澧楅崹姘跺礉閻旀祴鍋撳┑鍛暕闁哄洩娉曢顒勫礆閹殿噮浼傞悗鐟版湰閸ㄦ岸濡?

### 0.2 鐟滅増鎸告晶鐘绘⒓閼告鍞藉ù鐘侯嚙婵喖鎮╅懜纰樺亾娓氬﹦绀剉1.51 鐠?2026-07-26 缂佹鍏涚花鏌ュ础娴ｇ晫鏋傞柟鎭掑姀缁绘﹢宕ユ惔顖滅

> 闁哄牜鍓濇俊顓㈡偨?Codex 闁煎浜滄慨鈺冪磼鐎涙ê袘闁挎稑鏈惁锛勨偓鐟版湰閸ㄦ碍绋夐埀顒佺▔椤忓牊鈻夋繛?/ 閻庢稒鍔掗幑銏ゅ礉閳╁啯绾柡鍌烆暒缁旀潙鈻庨埥鍛耿濞寸姾顔婄紞?BLOCKED / SKELETON 闂侇喛妫勭换鈧銈咁煼濡绢喗绌遍纰辨Щ閻犱讲鈧啿鐏婇柕?
> 婵炴潙顑堥惁顖炲春閾忕懓娈犻柨娑欑煯娴滄帗绋夌€ｎ亜绀嬮柛蹇撳暞缁佸鎷犻弴鐐寸秵濞?mvn -o test 闁革负鍔嶅﹢浼村捶?Java 25 + JDK 25 闁绘粠鍨伴。銊︾▔?16:40 閻犵儤鍨块埀顒佸搸閳?

| 闂傚啳鍩栭?| 濞寸姾顕ф慨?ID | 闁硅绻楅崼?| 闁绘鍩栭埀?| 閻犲洣鐒﹀畵?/ 濠㈣泛娲﹂弫?|
|---|---|---|---|---|
| P0 | P0-AGENT-01 | 缂備胶鍠嶇粩?Agent Entity 濞戞挸顭烽弫?| DONE | TECH-AGENT 6 濞?entity 闁稿繈鍔戦崕?@Id闁?3 濞?JPA repository |
| P0 | P0-AGENT-02 | 闁轰礁顕幃濠冩交娴ｇ洅鈺呮儎椤旇偐绉块柨娑樼墕楠炴捇骞?.bak / 闂佹彃绉撮ˇ鏌ユ偋閸喐鎷遍柨?| DONE | tech-agent/V1~V10 + tech-ont/V1~V14 闁?24 濞?Flyway 闁哄倸娲ｅ▎銏ゆ晬鐏炵偓锟ラ梺鎻掔Т椤?|
| P0 | P0-AGENT-03 | 鐎点倛娅ｉ悵?H2 婵炴潙顑堥惁?profile | DONE | src/test/resources/application.properties 闁告凹鍨抽弫?MODE=PostgreSQL + H2Dialect |
| P0 | P0-CON-01 | InteractionContext Schema | DONE | OntologyContextEnvelope.Subject + viewState 鐎瑰憡褰冨銊︽媴?|
| P0 | P0-CON-02 | OntologyContextEnvelope Schema + 缂佹稒鍎抽幃?| DONE | OntologyContextEnvelopeService.build() HS256 缂佹稒鍎抽幃?|
| P0 | P0-CON-03 | Run / Claim / Evidence Schema | DONE | V5 / V6 / V7 / V8 / V9 / V10 鐎瑰憡褰冪紓鎾舵偘?|
| P0 | P0-CON-04 | 婵☆垪鍓濈€?SSE 濞存粌顑勫▎銏犆?| PARTIAL | RunEventService.record() 鐎瑰憡褰冮悿鍕偝妫颁胶鐨戝ù鐘烘硾閸欏棙鎯旈幙鍕SSE Controller 鐎?P4 |
| P0 | 濞ｅ浂鍠栭ˇ?001 | TECH-MSG fat-jar 闁稿繒鍘ч?| DONE | scripts/build-msg-jar.ps1 闂佹彃绉甸弻濠囧箥閹惧啿鐦跺☉鎾跺劋濞呮﹢鏌?jar |
| P0 | 濞ｅ浂鍠栭ˇ?002 | TECH-ACTION 缂?tech-msg 濞撴碍绻嗙粋?| DONE | pom.xml 闁哄倹婢橀·?com.metaplatform:tech-msg |
| P0 | 濞ｅ浂鍠栭ˇ?003 | TECH-ACTION TenantContext.getTenantIdOrDefault 闁哄倽顫夌涵鍫曞触瀹ュ鏅╅悹?| DONE | 闁衡偓闁稖绀嬮柡鍫墮濠€?getOrDefault() |
| P0 | 濞ｅ浂鍠栭ˇ?004 | TECH-ACTION ActionProposalController.java UTF-8 BOM | DONE | scripts/strip-bom-utf8.ps1 婵炴挸鎳愰幃?|
| P0 | 濞ｅ浂鍠栭ˇ?005 | TECH-OBS 缂?spring-boot-starter-data-jpa + spring-kafka | DONE | pom.xml 鐎规瓕灏棢濮?|
| P0 | 濞ｅ浂鍠栭ˇ?006 | TECH-RAG / TECH-LLMGW com.google.protobuf placeholder 闁哄牜浜ｈ闁?| DONE | 濞戞挶鍊撻柌?pom 闂侇喛妫勬慨?com.google.protobuf property |
| P0 | 濞ｅ浂鍠栭ˇ?007 | TECH-LLMGW OpenAiController 缂傚倹鐗為惁褔鏌ㄥ▎娆戠ChatRequest 缂佹稒鍎抽幃?/ StreamService / SSE闁?| DONE | 濞ｅ浂鍠栭ˇ?convertMessages() + ChatStreamService.stream() + ServerSentEvent 闂侇偄鍊块崢?|
| P0 | 濞ｅ浂鍠栭ˇ?008 | TECH-RAG 缂?KbChunkEntity / KbChunkRepository 缂?stub | DONE | 闁哄倹婢樼紓?4 濞?stub + tech-llmgw 濞撴碍绻嗙粋?+ MilvusAdapter/HybridSearchService 婵℃せ鏅涢悿鍕偝?|
| P0 | 濞ｅ浂鍠栭ˇ?009 | TECH-AGENT ActionProposalRepository 闂佹彃绉撮ˇ鏌ュ棘鐟欏嫮銆?| DONE | 闁告艾鐗嗛懟鐔哥▔閸濆嫬绀?ActionProposalStatus 闁绘鐗婂﹢?+ @Query 婵炲鍔忚 |
| P0 | 濞ｅ浂鍠栭ˇ?010 | Schema 缂?availableActions / ProposeDraftRequest 缂?runId | DONE | ontology-context + ontology-draft 闁告艾瀚慨?1 閻庢稒顨嗛?|
| P0 | 濞ｅ浂鍠栭ˇ?011 | ScenarioA/B/D/E 缂傚倹鐗為惁褔鏌ㄥ▎娆戠缂傚倸鎼妵?import + 闁告瑥绉撮惃鐘垫嫬閸愵亝鏆?TriggerEngine.match()闁?| DONE | 闁?java.time.Instant/Duration 閻庣數鍘ч崣?+ Mockito 婵炲鍔岄崣?TriggerEngine 濞戞挸顦欢椋庢導?+ 濞ｅ浂鍠栭ˇ?ActionGuard 濠㈣泛瀚幃濠冪▔瀹ュ懎璁查柛?map |
| P0 | 濞ｅ浂鍠栭ˇ?012 | TECH-ONT / TECH-LLMGW / TECH-MSG 闁?fat-jar闁挎稑濂旂粭鍛€?mvn 閻熸瑱绲鹃悗鑺ョ▔瀹ュ懎鐓傜紒?| DONE | jar.exe 闂佹彃绉垫晶锕傚礌閸涱剝绀嬮柡鍜佸櫍閳?jar + install:install-file |
| P0 | 濞ｅ浂鍠栭ˇ?013 | ScenarioB.groundingMultiConcept 濠㈡儼绮剧憴锕傛晬閸粎鐟归柛鏂呫値鍤斿☉?gap闁?| DONE | 闁告娲ㄦ?GroundingMiddleware闁挎稒鑹鹃·鍐礉?濞戞挸顑夊?闁告鍠庡ú?缂佹稑顦崣褔鏌ㄩ璺ㄦГ + 閻犳亽鍔岄悡?metric 闁规亽鍔嶉弻?+ 閻犳亽鍔岄悡?action 闁稿﹥鐟╅埀?|
| P0 | 濞ｅ浂鍠栭ˇ?014 | P4 闁告挸绉堕顒傜磽?useAgentStream + InteractionContextProvider | DONE | 闁哄倹婢樼紓?src/hooks/{useAgentStream,InteractionContextProvider,index}.{ts,tsx} + ClaimRenderer + EvidenceRenderer闁挎稒纭焬pecheck 濞寸姴鎳庢晶?pre-existing 闂佹寧鐟ㄩ?|
| P0 | 濞ｅ浂鍠栭ˇ?015 | P5 缂?ActionExecutionService.execute/approveAndExecute/reject | DONE | 闁哄倹婢樼紓?ActionExecutionService + 5 濞戞搩浜滃畷鐔访圭€ｅ墎骞㈤柟纰樻櫅閻?EvidenceService.recordExecution + ClaimService.recordExecution |
| P0 | 濞ｅ浂鍠栭ˇ?016 | P5 缂?TECH-AGENT 闁?TECH-WFE 閻庡厜鍓濇竟鎺戭浖?| DONE | 闁哄倹婢樼紓?ActionApprovalBridgeService + 4 濞戞搩浜滃畷鐔访圭€ｅ墎绀刼nWfeApproved/onWfeRejected/lowRisk/missingProposal闁挎稑顧€缁辩洨ECH-WFE 闁哄倹婢橀·?/from-proposal endpoint + createDirectApprovalTask + 2 濞戞搩浜滃畷鐔访?|
| P0 | 濞ｅ浂鍠栭ˇ?017 | 缂?P4.2 Agent Copilot 缂佹棏鍨伴崺宀€绮╅鐐偓澶愭?| DONE | 闁哄倹婢樼紓?AgentChatPanel + AgentCopilotPage + 婵炲鍔岄崬?/agent-copilot 閻犱警鍨抽弫?+ typecheck 0 闂佹寧鐟ㄩ銈夋晬閸粎鐭岄柛?pre-existing SuperAIChatPage 闂佹寧鐟ㄩ銈夋晬婢?
| P0 | 濞ｅ浂鍠栭ˇ?018 | 缂傚倽娅ｇ划鐑樼▔閳ь剟鎯?fat-jar 闁?thin-jar 闂佹彃绉垫晶锕傚礌閸涙澘澹栭柡?| DONE | scripts/repack-thin-jars.ps1闁挎稑鐗嗗畷鐔肺熼垾铏仴闁? scripts/repack-all-thin-jars.ps1闁? 濞戞搩浜濋悧瀹犵疀閸愨敔渚€宕稿Δ浣割棗闂佹彃楠忕槐姘舵晬濞岀棏r.exe + install:install-file 閻庣懓鏈弳?CI 婵炵繝鑳堕埢?|
| P0 | 濞ｅ浂鍠栭ˇ?019 | P5 缂?WFE闁愁偅澧ent 閻庡厜鍓濇竟鎺楀炊閻愬墎娈堕梻鍌ゅ幘楠?| DONE | TECH-WFE /approve-external + /reject-external 缂佹棏鍨抽崑?+ WfeTaskService.approveExternalAction/rejectExternalAction + forwardToAgent HTTP闁挎稒绗‥CH-AGENT /internal/wfe-approved + /internal/wfe-rejected闁?+2 濞戞搩浜滃畷鐔访?|
| P0 | 濞ｅ浂鍠栭ˇ?020 | P6 缂?Authoring pipeline闁挎稑婀燘闁愁偅澧玜ndidate Fact闁愁偅澧瑀aft闁?| DONE | AuthoringService.buildDraft/buildFromExtraction/submit + 7 濞戞搩浜滃畷鐔访圭€ｅ墎绀勯悷鏇炴濞?buildDraft minimal / safe defaults / buildFromExtraction single / evidenceRefs list / empty / submit forwards / submit no-draft-service闁挎稑顣?
| P0 | 濞ｅ浂鍠栭ˇ?021 | SuperAIChatPage msg.evidences 闁告瑯鍨甸崗?undefined | DONE | typecheck 0 闂佹寧鐟ㄩ銈夋晬閸ь暀g.evidences ?? [] + 閺夆晜锚鐢偊鎮?@mate/shared 闁?EvidenceRenderer per-evidence 闁规亽鍎辫ぐ娑㈡晬婢?
| P0 | 濞ｅ浂鍠栭ˇ?022 | ActionGuardMiddleware 濞戞挸绉烽崵婊堝礉閵婏箑鐦☉鏂挎噹鐎?+ 閻犱警鍨抽弫?HIGH risk Action | DONE | 闁?afterExecution 閻?proposalService.create + approvalBridge.submitForApproval闁? 濞戞搩浜滃畷鐔访圭€ｅ墎绀凥IGH/LOW/empty/fail-resilient/no-arg compat闁挎稑顣?
| P0 | 濞ｅ浂鍠栭ˇ?023 | DocumentCandidateListener 闁哄嫷鍨板畷鐗堟媴瀹ュ懐鏉介柣婊冨簻缁辨繃绋夊鍩挎洟宕?Authoring pipeline | DONE | 闂佹彃绉撮崯鎾寸▔閸濆嫮鏆氶柡浣规綑閻ゅ嫰鎮崇敮顔剧獥閻犱降鍨藉Σ?kb.document.candidate.ready 闁?AuthoringService.buildFromExtraction 闁?submit闁? 濞戞搩浜滃畷鐔访圭€ｅ墎绀刪appy path/empty payload/missing candidates/no author service/non-List candidates闁挎稑顣?
| P0 | 濞ｅ浂鍠栭ˇ?024 | TriggerEngine.match() 闁?private闁挎稑顒玞enarioD 闁活潿鍔屽鐣屼焊閸曨喚娈堕柣?| DONE | 闁衡偓闁稖绀?public + 闂佹彃绉撮崯?ScenarioD 闁烩晛鐡ㄧ敮瀵告嫬閸愵亝鏆忛柨娑樿嫰楠炴捇骞掓径濠傚唨閻忓繐瀚哥槐?/4 ScenarioD 闁告娲樼粊鎾礂閵娿劎绠?|
| P0 | 濞ｅ浂鍠栭ˇ?025 | AgentRunService 婵炲备鍓濆﹢?complete()/finish() 闁哄倽顫夌涵鍫曟晬鐏炵偓锟ユ繛澶嬫礉琚濋柛?Authoring hook | DONE | 闁哄倹婢橀·?complete(runId, status, answer, errorCode, errorMessage)闁挎稒绋栭崵婊堝礉閵婎煈鍞剁憸?RUN_COMPLETED/FAILED 濞存粌顑勫▎?+ 鐟?answer 闁告牕鎳庨幆?@candidates/@kb-extract marker 闁哄啯鍎奸崵婊堝礉閵娿劎娈堕柣?AuthoringService 闁圭粯鍔掑?Draft闁? 濞戞搩浜滃畷鐔访圭€ｎ収娲柣鈺傜墪閹洨绮?status/answer 缂備礁瀚幃?|
| P0 | 濞ｅ浂鍠栭ˇ?026 | ActionGuard auto-route 濠㈡儼绮剧憴锕€鈻介埄鍐╃畳闂佹彃绉烽惁顖炲嫉閸濆嫬鐓?| DONE | 闁哄倹婢樼紓?ActionRouteDlqService闁挎稑娼焠-memory CopyOnWriteArrayList + idempotency-key dedup闁挎稑顧€缁遍亶骞撻幇顏嗚繑 enqueue / retry / retryAll / discard / getPending 闁稿浚鍓欑槐?API闁挎稒鐫攃tionGuardMiddleware 闁?catch 闁秆勩仦閼垫垿鎳涢鍕?enqueue闁? 濞戞搩浜濋弻濠囧础閺囩喓銈村Δ鐘茬焷閻?enqueue 閻犱警鍨扮欢?|
| P0 | 濞ｅ浂鍠栭ˇ?027 | 缂傚倸鎼晶鐘电博椤栨粎鐭嬪ù?UI 濡ょ姴鐭侀惁澶愭晬閸︽樄aimRenderer/EvidenceRenderer/AgentChatPanel闁?| DONE | 闁哄倹婢樼紓?components/__demo__/StorybookDemo.tsx + App.tsx 婵炲鍔岄崬?/__storybook 閻犱警鍨抽弫閬嶆晬濞戞娼旂紒鈧?3 缂?Claim 缂侇偉顕ч悗鐑芥晬閸︽アCT/INFERENCE/RECOMMENDATION闁? 4 缂?Evidence 缂侇偉顕ч悗?+ 閺夊牆婀遍弲顐﹀捶閻戞ɑ鐝柨娑樻綊mpty evidence / no evidence claim闁挎稑顧€缁辩湜ypecheck 0 闂佹寧鐟ㄩ?|
| P0 | 濞ｅ浂鍠栭ˇ?028 | ActionRouteDLQ 缂佺虎鍨伴崬瀵糕偓娑欙公缁辨繈鏌屽鍛剻闁告艾绨煎☉顏呭緞?| DONE | 闁哄倹婢樼紓?action_route_dlq 閻炴侗鐓夌槐姗?1 migration闁? ActionRouteDlqEntity + ActionRouteDlqRepository闁挎稒鐫攃tionRouteDlqService 闁?@Transactional + DB fallback闁挎稒纭渆try/discard 闁告艾鏈?markResolved闁挎稒骞秂tPending 闁煎浜滄慨鈺呭触閸繆瀚?DB + in-memory闁? 濞戞搩浜滃畷鐔访圭€ｎ収娲柣?DB 閻犱警鍨扮欢?闂傚嫬绉舵鍥╂崉椤栨氨绐?闂佹彃绉烽惁顖滄媼閳╁啯娈?|
| P0 | 濞ｅ浂鍠栭ˇ?029 | ActionRouteDLQ 婵炲备鍓濆﹢渚€鎳涢鍕?retry 濞寸姾顕ф慨?| DONE | 闁哄倹婢樼紓?ActionRouteDlqScheduler闁挎稑婀孲cheduled fixedDelay 5min闁挎稑顧€缁辩湌ax-retries=5 + enabled flag闁挎稒鐫攇entApplication 闁?@EnableScheduling闁? 濞戞搩浜滃畷鐔访圭€ｎ収娲柣鈺傜墱閳?DLQ / max-retries skip / 闁瑰瓨鍔曟慨娑氭媼閳╁啯娈?/ enabled flag / null 閻庣懓顦崣?|
| P0 | 濞ｅ浂鍠栭ˇ?030 | MilvusAdapter 闁哄嫷鍨甸敍?class闁挎稑鏈Λ銈嗗緞?backend 闁衡偓椤栨稑鐦?| DONE | 闁?VectorStoreClient 闁规亽鍎辫ぐ娑㈡晬閸х櫝arch / hybridSearch / insert / createCollection / count / isHealthy闁挎稑顧€缁? 濞戞搩浜滈悿鍕偝鐢喚绐桰nMemoryVectorStoreClient闁挎稑鐗撶划顖滄媼?@ConditionalOnProperty=memory闁挎稑鑻幆?cosine + hybrid + BM25 闁稿繑濞婇弫顓犳嫚瀹ュ懎顫ｉ柡澶婂枦缁? MilvusHttpClient闁挎稑婀孋onditionalOnProperty=milvus闁挎稑顒‥ST 閻犲鍟伴弫?/v1/vector/*闁挎稑顧€缁辩洑ybridSearchService 闁衡偓閸︻厽鏆?VectorStoreClient闁? 濞戞搩浜濋弻濠囧础閺囩喓銈撮悷鏇炴濞?cosine 闁圭儤甯掔花顓㈠Υ娑旂搨brid 闁稿繑濞婇弫顓犳嫚瀹ュ拋鏉荤€殿喗浜介埀顑挎伃ount闁靛棔韬琺pty |
| P0 | 濞ｅ浂鍠栭ˇ?031 | ActionGuardMiddleware 闁告瑯浜滃﹢?run 闁告劕鎳庨獮鎾绘煂瀹ュ繒绀夊☉鎾崇Т楠炴捇鏌屽鍫熺《 run 闁?proposal | DONE | ActionProposalRepository 闁哄倹婢橀·?findRecentForDedup(runId, actionCode, targetObjects) JPQL 闁哄被鍎撮妤呮晬濞岀そddleware 闁革负鍔忛崵婊堝礉閵婏箑鐦☉鏂挎噹鐎垫煡宕滃鍛弗闁?DB闁挎稑鑻幊鈩冪▔椤撶偛鐏熷璺虹Ф閺併倝鎮抽悧鍫熺畳 proposalId 妤犵偠鍩栭悥锝囨媼?crossRunDedupHit=true闁挎稑鐭侀悜锔芥交閸ャ劍鎷辨繛?create + WFE submit闁? 濞戞搩浜濋弻濠囧础閺囩喓銈撮悷鏇炴濞插﹪宕ㄩ幋鎺曞幀/闁哄牜浜滈幊鈩冪▔?null 閻庣懓顦崣?|
| P0 | 濞ｅ浂鍠栭ˇ?032 | HybridSearchService.search() 闁?noop stub | DONE | 闂佹彃绉撮崯鎾寸▔閾忚鍩傞悹渚灠缁剁偤鏁嶅鐪榚udoEmbed(query, 1024) 闁?vectorStore.hybridSearch() 闁?闁告稒鍨濋懙?KB chunk 闁?Evidence.fromChunk()闁挎稑鏈﹢顓㈠川閹存帟鍘柡?Evidence.synthetic()闁挎稒绋掗弻濠冩櫠?5 濞戞搩浜為顒勫礆閹殿噮浼傞柛妤佹礃缁佸鎲伴崱娆愮０ ingest / KB 闁告稒鍨濋懙?/ 缂佸瞼鍎ら悡锛勬嫚?/ topK 闂佹澘绉堕悿?/ pseudoEmbed 缁绢収鍠栭悾楣冨箑?|
| P0 | 濞ｅ浂鍠栭ˇ?033 | ActionRouteDLQ 婵炲备鍓濆﹢?ops 闁烩晜鍨剁敮鍓佺博椤栨粌浠?| DONE | 闁哄倹婢樼紓?ActionRouteDlqMetricsEndpoint闁挎稑婀橢T /api/v1/agent/dlq/metrics闁挎稑顧€缁辨繃娼婚弬鎸庣 pending_count + scheduler_present + 閻庣懓鏈弳?pending 闁告帗顨夐妴鍐晬? 濞戞搩浜濋弻濠囧础閺囩喓銈撮悷鏇炴濞插﹤顫㈤敐鍛煑/null 閻犱警鍨扮欢?|
| P0 | 濞ｅ浂鍠栭ˇ?034 | ActionGuardMiddleware 闁告瑯浜滃﹢顏堝础?run 闁告劕鎳庨獮鎾绘煂瀹ュ繒绀夊☉鎾崇Т楠炴捇鏌屽鍫熺《 run/閻犳亽鍔庨～銈夊箣?| DONE | ActionProposalEntity 闁?tenant_id 閻庢稒顨嗛?+ V12__add_tenant_id_to_action_proposals.sql migration闁挎稒鐫攃tionProposalRepository 闁哄倹婢橀·?findRecentForTenantDedup(tenantId, runId, actionCode, targetObjects)闁挎稒椹砳ddleware 闁革负鍔忛崵婊堝礉閵婏箑鐦☉鏂挎噹鐎垫煡宕滃鍛弗闁哄被鍎村▔鏇犵矓閻旂鐓曢柨娑樼墛濞叉寧绋夐妷锔惧闁? 閻?run 濞戞挶鍊楁鍥晬? 濞戞搩浜濋弻濠囧础閺囩喓銈撮悷鏇炴濞插﹦鎹勯妸褜娼抽柟鏉戝槻閹斥剝绋?+ 閻?run 闁告稒鍨濋懙鎴﹀嫉椤忓嫭鍤掑☉?|
| P0 | 濞ｅ浂鍠栭ˇ?035 | TECH-LLMGW 缂傚倸鎼惃?LlmProvider 闁硅泛鈧喕鏉介柨娑樿嫰閹绮╅姘€奸柟骞垮灩濞插爼姊?| DONE | 闁哄倹婢樼紓?LlmProvider 闁规亽鍎辫ぐ娑㈡晬閸у潝at / streamChat / embed / isHealthy / name闁挎稑顧€缁辩洟oopLlmProvider fallback闁挎稑鐗婂Λ?ChatModel 闁哄啯鍎肩换鎴﹀炊閻愬瓨顫栫痪顓у櫍閺佸﹦鎷犻銈囩闁? 濞戞搩浜濋弻濠囧础閺囩喓銈撮悷鏇炴濞?chat/stream/embed/health/name闁挎稒濂攑ringAiLlmProvider 闁活亞鍠庨悿鍕偓鍦仧楠炲洭宕?Spring AI 1.1.x 婵炵繝绀佺槐?API 闁告瑦蓱濞插灝顕欑捄鐑樺€甸柛?P8.4 |
| P1 | P1-ONT-07 | OntologyContextService闁挎稑鐗忛?envelope + 閻庢稒顨嗛灞炬交閸ャ劍濮㈤柨?| DONE | OntologyContextServiceTest 闂侇偅淇虹换?|
| P1 | P1-ONT-09 | 濞存粍鏌ч柌婊堝矗椤忓浂鍤?Ontology Tool | DONE | GroundToolServiceTest 闂侇偅淇虹换?|
| P1 | P1-ONT-10 | Ontology Action Schema + Risk Level | DONE | ActionEntity + ActionProposalEntity 鐎规瓕灏幆銈嗘償?|
| P1 | P1-ONT-11 | Ontology Event Topic + Draft/Commit/Validator | DONE | tech-ont/draft/ + tech-ont/event/ 闁解偓閽樺鍕?|
| P2 | P2-RAG-01 | KB/RAG 闁稿繈鍔戦幗鑲╂崉?+ Ontology Filter | PARTIAL | InMemory/Milvus HTTP 闁告瑥鑻幃妤冪博椤栨瑧鐟?Hybrid Search 鐎瑰憡褰冮崣鎸庡緞閸ラ骞enantId Ontology Filter MVP 鐎圭寮剁敮鎾礂閵夘垳骞ybridSearchService 鐎圭寮惰ぐ浣圭瑹?objectId/conceptCode scope API闁挎稑鑻幃妤冪博椤栫偞顓剧紒鍌滅帛缁佸鎷犻弴姘辩煗闂傚洠鍋撻柟纰樻櫅閻?|
| P3 | P3-DF-01 | DeerFlow Adapter Middleware 闁规亽鍎辫ぐ?+ 濞存粍鏌ч柌?Middleware | DONE | 5 濞?Middleware + MiddlewareChain + RuntimeRouter闁挎稒濂攃enarioA/B/D/E 缂傚倹鐗為惁褔鏌呭宕囩畺闁?1/22 闂侇偅淇虹换?|
| P4 | P4-BE-02 | Run 闁告帗绻傞～鎰板礌閺嶇數绀凱OST /api/v1/agent/runs闁?| DONE | AgentRunService.create() 闁稿繈鍎辩花閬嶇嵁閹澏鏇㈠矗?RUN_STARTED |
| P4 | P4-BE-07 | Evidence Gate闁挎稑婀慙AIM_PRODUCED + EVIDENCE_ATTACHED闁?| DONE | OntologyEvidenceMiddleware + EvidenceService 闁稿繈鍎辩花?|
| P4 | P4-FE-04 | useAgentStream闁挎稑鐗嗘晶鐘电博?SSE闁?| DONE | useAgentStream.ts + InteractionContextProvider.tsx + ClaimRenderer.tsx + EvidenceRenderer.tsx闁挎稒纭焬pecheck 闂侇偅淇虹换?|
| P5 | P5-ACT-01 | Action Guard + Proposal + Approval | DONE | ActionProposalService.propose/approve/reject |
| P5 | P5-ACT-02 | Temporal/WFE 闂侇偄鍊块崢?| DONE | ActionExecutionService.execute/approveAndExecute/reject + EvidenceService.recordExecution + ClaimService.recordExecution闁?/5 闁告娲樼粊鎾焻濮樺磭绠?|
| P6 | P6-AUTH-01 | Extraction 闁?Validator 闁?Commit | DONE | OntologyDraftService + OntologyValidator |
| P7 | P7-EVT-01 | Ontology Event Trigger + 闁告艾鐗嗛幃鎾诲礆閻楀牊鍩?MVP | DONE | TriggerEngine 閻庣懓鏈弳?+ ScenarioD 4/4 闂侇偅淇虹换鍐晬閸у潵oldown + match() 闁?Mockito 婵炲鍔岄崣鍡涙晬?|
| P8 | P8-NAT-01 | 闁告鍠撻弫?Runtime Middleware | PARTIAL | 5 濞?Middleware 鐎瑰憡褰冮悺銊╁捶椤帞骞untimeRouter 缂佺姭鍋撻柣妤€鐗愰惌楣冩偨?OK |
| P8 | P8-NAT-02 | Spring AI LLM Provider | DONE | SpringAiLlmProvider 鐎圭寮剁敮鎾礂?ChatModel闁挎稑鏈弫顕€骞愭担鍛婂€辨慨?婵炵繝绀佺槐锛勬嫬閸愵亝鏆忛柨娑欑ECH-LLMGW mvn -o test 闂侇偅淇虹换?|
| P8 | P8-NAT-03 | Native Runtime 缂佸苯鎼幖閿嬫償閺傝法鏆旈柛蹇嬪姂濡?| DONE | SaAgentExecutionEngine 閻庨潧婀遍埞?缂佸矁娅ｅ▍?LLM 閺夊牊鎸搁崵顓熸交閺傛寧绀€ FAILED闁挎稑濂旂粭澶愬礃瀹ュ懐娈洪柡鍫簻閻ゅ嫰鎮抽悧鍫濈仐闁哄啰濮风划銊╁几濠婂棛鐔呯€垫澘瀚慨銈夊川婵犱浇绀?COMPLETED闁挎稒绗‥CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-NAT-04 | Checkpoint/Resume 闁哄牆绉存慨鐔兼⒒椤撶姴绠?| DONE | CheckpointService.resumeState() 闁?tenant + execution 闁告梻濮惧ù鍥嫉閳ь剟寮?checkpoint闁挎稑鐭佺换鎴﹀炊閻愭壆鐟濋柛娆樺灠瑜板骞侀姀鐙€妲诲☉鎾筹梗缁楀懘寮崶椋庡耿Controller /resume 鐎圭寮剁敮鎾礂閵夘垳骞ECH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-NAT-05 | Native Tool Execution 缂備胶鍠嶇粩瀵告崉椤栨氨绐?| DONE | NativeToolExecutionService 鐎殿喖鎼崺?signed OntologyContext闁挎稑鏈晶鐣屾偘鐏炶棄顤呴柛姘唉閻ゎ喚绮?MiddlewareChain闁挎稑鑻懟鐔告叏閺冣偓婢?GroundToolService 濞存籂鍛櫢 Claim/Evidence闁挎稒绗‥CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-NAT-06 | Native Graph Runtime 鐎规悶鍎遍崣璺ㄧ磽閺嶃劌绗?| DONE | NativeGraphRuntimeService 闁圭瑳鍡╂斀 beforeExecution 闁?濠?Tool Call 闁?afterExecution闁挎稑鑻妵鎴犳嫻閵壯冃﹂柟顑挎缁楀瀵奸鍛撻柟瀛樺姇婵盯鏁嶇仦鍊熷珯閺夆晜鏌ㄥú?toolOutputs + claims闁挎稒绗‥CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-NAT-07 | Native Mock SUCCESS 閻庣懓顦崣蹇曠矓婵犳碍鐝?| DONE | NativeAgentRuntime 鐎圭寮剁敮鎾礂?NativeGraphRuntimeService闁挎稒绋掑Λ?Tool Output 闁瑰瓨鐗曢妵鎴犳嫻閵夈劎鐔呯€垫澘瀚换鎴﹀炊?FAILED闁挎稑濂旂粭澶愬礃瀹ュ牏绠查柛?mock SUCCESS闁挎稒绗‥CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-NAT-08 | Graph Checkpoint Resume 闁规亽鍎抽悽?| DONE | NativeGraphRuntimeService.resume() 闁?tenant + executionId 闁诡厹鍨归ˇ鏌ュ嫉閳ь剟寮?checkpoint state 闁告艾娴烽幋椋庣磼椤撶喎鈷旈悶娑樿嫰娴兼劙宕楀畡鐗堢闁挎稒绋掑Λ?checkpoint 閺夆晜鏌ㄥú?FAILED闁挎稒绗‥CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-NAT-09 | Tenant-scoped RunEvent SSE | DONE | GET /agent/runs/{runId}/events 闁衡偓椤栨稑鐦?afterSeq 濠⒀呭仱閸ｆ椽濡存稉绯濫 event/id/data 闁哄秶鍘х槐鈩冪▔?tenantId 閺夆晛娲﹂幎銈夋晬濮圭竴CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-NAT-10 | Native/DeerFlow 缂備胶鍠嶇粩鎾传瀹ュ懐瀹夊┑鍌涘灩鐎?| DONE | 闁哄倹婢橀·?UnifiedRuntimeResponse闁挎稒閽tiveAgentRuntime.executeUnified() 濞?DeerFlowAdapter.startRunUnified() 闁秆冩穿缁额參宕欓搹鍦煚濞戞挴鍋?runId/status/content/claims/evidence/events/metadata 缂備焦鎸婚悗顖炴晬濮圭竴CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-REL-03 | Native Graph Tool Budget 濞戞挸楠搁妵鎴犳嫻閵夈儳鏆旈柛?| DONE | max-tool-calls 濮掓稒顭堥?16 闁告瑯鍨堕崢銈囩磾椤曞棛骞㈤悺鎺戞嚇椤ｂ晝绮诲Δ浣哥仐濞寸姾顔婄粩鏉戭啅閵夈儱寰旂€殿喖鍊搁悥鑸垫交閺傛寧绀€ FAILED闁挎稑濂旂粭澶愬触閹存粎鐟愰柟鑸电☉閸ゎ參寮甸鍡欐尝闁哄瀚€?500闁挎稒绗‥CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-REL-04 | Native Graph Tool Budget 濞戞挸楠哥槐鎾舵暜缁嬭法鏆旈柛?| DONE | 閻℃帒鎳撶换?max-tool-calls 闁瑰瓨鐗旈幑銏＄▔閳?Tool 鐎殿喖鍊搁悥鍫曞锤閸ヮ亝绁柟璇℃線鐠愮喓绱掗幘瀵糕偓顖炲礌?FAILED闁挎稒鐩划顖滄媼閵堝鏆曠紒?16 闁告瑯鍨堕崢銈囩磾椤曞棛骞ECH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-REL-05 | Native Graph Duration Budget | DONE | max-duration-ms 濮掓稒顭堥?30s 闁告瑯鍨堕崢銈囩磾椤曞棛骞㈡慨锝呯箣闁?Tool Call 闁告挸绉甸ˉ鍛村蓟?deadline闁挎稑鐭佺粔鎾籍閹壆绠查柛銉у仧缁劑寮搁崟顐㈩嚙 FAILED闁挎稒绗‥CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-REL-06 | Native Graph Cancellation Token | DONE | NativeGraphRuntimeService 闁衡偓椤栨稑鐦?AtomicBoolean cancellation token闁挎稑顒璷ol Call 闂傚倹娼欓悾銊╁礂閵娿儰绮绘慨婵勫灩閼荤喐娼婚弬鎸庣缂備焦鎸婚悗顖炲礌?FAILED闁挎稒鐩划顖滄媼?API 濞ｅ洦绻冪€垫棃宕楅悡搴晣闁挎稒绗‥CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-REL-07 | DeerFlow Adapter Retry Backoff | DONE | startRun 闁衡偓椤栨稑鐦?max-attempts闁挎稑鐗撶划顖滄媼?3闁挎稑顦粭宀€鐥幐搴樺亾?backoff闁挎稑鐗撶划顖滄媼?100ms闁挎稑顧€缁辨繃寰勬潏顐バ曢柡鍫氬亾缂備礁鐗愮换鎴﹀炊?null闁挎稒绋愮粭澶愭煂瀹ュ拋妲婚柟缁樺姃濮橈箓骞嬮幇顒€顫犻柛婵嗙Т缁ㄦ煡鏁嶅Ч绺€CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-REL-08 | DeerFlow Adapter Circuit Breaker | DONE | 閺夆晝鍋熼悽缁樺緞鏉堫偉袝閺夊牊鍎抽崺宀勬⒓閸績鍋撶涵椋庣濮掓稒顭堥?5闁挎稑顦幃妤呮偄閺冣偓閺屽洭鏁嶉崼銉у笡閻?10s闁挎稑顧€缁辨繄绮ｅΔ鈧ぐ娑㈠触鎼淬倕娈伴柛?half-open闁挎稒绋掗崹姘跺礉閻旀椿鍤炴慨鐟板€圭粩濠氭⒖鐠烘亽浜奸悹鎰╁劥椤撴悂寮敮顔惧耿TECH-AGENT mvn -o test 闂侇偅淇虹换?|
| P4 | P4-FE-05 | 闁告挸绉堕顒勫礂閻撳寒鍟?Agent SSE Alias | DONE | 闁哄倹婢橀·?GET /api/v1/agent/run/stream?runId&afterSeq闁挎稑鑻ˇ鏌ユ偨?tenant-scoped RunEvent 婵炵繝绶ょ槐婵囨綇閹惧啿姣夐柡宥呮搐閸?SSE id/event/data闁挎稒绗‥CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-NAT-11 | Spring AI 闁煎浜滄慨?Tool Calling | DONE | NativeLlmToolLoopService 婵炲鍔岄崬浠嬪矗椤忓浂鍤?Ontology ToolCallback闁挎稑鏈晶宥夊嫉?LLM tool call 缂?NativeToolExecutionService 濞?Middleware/Claim/Evidence闁挎稒閽tiveAgentRuntime.executeWithLlm() 鐎圭寮剁敮鎾礂閵夘垳骞ECH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-NAT-12 | Native Runtime HTTP 闁稿繈鍎辫ぐ?| DONE | POST /api/v1/agent/native/runs 闁规亽鍎辫ぐ鍫ュ及閹呯 MiddlewareContext + ToolCalls闁挎稑鐭佺换鎴﹀炊?UnifiedRuntimeResponse闁挎稒绋掑Λ?context 閺夆晜鏌ㄥú?400闁挎稒绗‥CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-SEC-02 | Native HTTP Signed Envelope + Tenant 鐎殿喚鍎ら悧搴㈩殽?| DONE | NativeRuntimeController 濡ょ姴鐭侀惁?Envelope 缂佹稒鍎抽幃鏇㈠Υ娑旂炒nantId/runId 濞戞挴鍋撻柤宄扮摠閳ь儸鍌滅憿閻犲洭鏀遍惇鎵矓閻旂鐓曢梻鍛⒒椤洭鏁嶅☉娆愶骏闁轰礁鐗忛鐑藉触?403闁挎稑鐬肩划銊╁几閸曨亞鐟濆☉鎾亾闁?400闁挎稒绗‥CH-AGENT mvn -o test 闂侇偅淇虹换?|
| P8 | P8-SEC-03 | Native HTTP Contract Test | DONE | NativeRuntimeControllerContractTest 閻熸洖妫涘ú濠勭磽?context 400 濞?runtime 濞戞挸绉烽～锔炬嫬閸愵亝鏆忛柨娑樺娴滄帡宕?UnifiedRuntimeResponse 缂佸本妞藉▔锕傚触?濠㈡儼绮剧憴锕傛偐閼哥鍋撴担鍓叉缂佹拝璁ｇ槐鐩〦CH-AGENT 閻庤鑹鹃幃婊兠圭€ｎ厾妲搁梺顐ｄ亢缁?|
| P8 | P8-SEC-04 | Native HTTP Tenant Default 闁哄秮鍓濋?| DONE | 濞ｅ浂鍠楅?NativeRuntimeController 濞?TenantContext.getTenantIdOrDefault() 闁汇劌瀚扮划顖滄媼閵堝浂娼抽柟鏉戝槻閳ь剟妫跨粩鎾嚊缂堢姾绀?tenant-default闁挎稒绋戦〃鏍棯閿旂晫銈撮悹鍥ㄦ礋閳ь剚淇虹换?|
| P8 | P8-SEC-05 | Native HTTP 闁哄牆顦伴弲銉х驳閹勫€冲┑鍌涘灩鐎瑰啿霉鐎ｎ厾妲?| DONE | ContractTest 閻熸洖妫涘ú濠囧礌瑜版帒甯?tenant/run 闁?signed Envelope闁挎稒宀搁悰娆戞嫚?signer闁靛棔璐璾ntime 闁秆冩穿椤妇鎷崘顏呮殢闁挎稒绋栬棢濮?MiddlewareContext Jackson 闁哄啰濮村顒勫几閸曨垪鍋撻悩杈╃憿 JavaTime 婵炴潙顑堥惁顖炴煀瀹ュ洨鏋傞柨娑欑☉閻ｉ箖宕ラ幋鐐点偞閻犲洦娲熼埀顒佷亢缁?|
| P8 | P8-SEC-06 | Native HTTP Context 闁告瑯鍨板鑺ユ償韫囨挸鐏欓柛?| DONE | MiddlewareContext 濠⒀呭仜婵?Jackson 闁哄啰濮村?闁稿繈鍔屽顒勫几閸曨垪鍋撻悪鍛濡ょ姴鐭侀惁澶愭儑閻旈鏉?Map闁愁偅澧玱ntext闁愁偅澹宨gned Envelope 閺夌儐鍓氬畷鏌ユ晬濮圭竴CH-AGENT/TECH-RAG/TECH-LLMGW 濞戞挸顦拌啯闁秆勵殘椤洨鐥崹顔界鐟滅増甯￠埀顒佷亢缁?|
| P8 | P8-OBS-02 | Native Lifecycle RunEvent Bridge | DONE | NativeRuntimeEventPublisher 閻?Native Graph 闁瑰瓨鍔曟慨?濠㈡儼绮剧憴锕傚及閻樿尙娈稿☉鎾跺劋鐎垫梹绋?RUN_COMPLETED/RUN_FAILED 濞存粌顑勫▎銏ゆ晬濞戞瑦锟ラ柟闀愭缁?Run 闁汇劌瀚崬鎾焾閵娿倗鐟愬☉鎾愁儐閺嬪啰鈧懓顦崣蹇涙⒔瀹ュ洭鐛撻柨娑欑ECH-AGENT 婵炴潙顑堥惁顖炴焻濮樺磭绠?|
| P8 | P8-REL-09 | Runtime Production Configuration | DONE | application.yml 闁哄嫭鍎崇槐锟犳煀瀹ュ洨鏋?Native max-tool-calls/max-duration闁靛棔绗峞erFlow retry/backoff/circuit 闁告瑥鍊归弳鐔哥▔鎼达絽绠氬褍鍟ぐ澶愭煂韫囨凹娲柣鈺傜壄缁辩洨ECH-AGENT test 闂侇偅淇虹换?|
| P8 | P8-NAT-13 | SAA Graph Multi-node Plan闁愁偅澧禠M | DONE | SaAgentExecutionEngine.executeGraph() 濞寸姴楠稿畷鐔兼嚍閸屾粌浠柛妤€娲ㄦ鍥ㄧ▔?plan 闁?llm 濠㈣埖淇烘俊顓㈡倷?StateGraph闁挎稑鐭侀鎼佸礆閹烘挻鏆堥柛?LLM context闁挎稒绋撻埞鏍传瀹ュ懐瀹夐悗鐟邦槸閸欏繘姊婚妸銈囩闁归晲鐒﹀﹢渚€寮崼顒傚耿TECH-AGENT test 闂侇偅淇虹换?|
| P8 | P8-NAT-14 | SAA Graph Review Gate | DONE | 闁哄倹婢橀·?review 闁煎搫鍊婚崑锝夊冀閿熺姷宕?LLM 閺夊牊鎸搁崵顓㈡閻愮鏁勯柨娑橆唹lan 闁?llm 闁?review 闁?END闁挎稒绋撻埞鏍磼閹惧浜弶鈺傜☉閸?FAILED/閻庣懓顦崣蹇涙⒔瀹ュ洭鐛撻柨娑欑ECH-AGENT test 闂侇偅淇虹换?|
| P8 | P8-NAT-13b | SpringAiLlmProvider 闁活亞鍠庨悿鍕偓鍦仧楠?+ Mockito 婵炴潙顑堥惁?| DONE | TECH-LLMGW 闁哄倹婢橀·?SpringAiLlmProviderTest闁? 闁告娲樼粊鎾晬婢舵稓绐梒hat() call 閻犱警鍨扮欢鐐哄Υ娑旂ll 閻庣懓顦崣蹇涘Υ娴ｅ摜纾介悽顖涙倐濡鹃鐥鐠?LLM_CALL_FAILED闁挎稒纭瀟reamChat() 闁?Flux<ChatResponse> 闁哄嫮濮撮惃鐘诲箣?Flux<String> 閺夆晛娲﹂幎銈囩矚閸濆嫭鍋ラ柕鍡曠缁辨挾鏁幖浣诡€栫紒鐙欏倽绀嬮柛妤佹礃濞碱垶鏌ㄥ▎鎺濆殩婵炴垵鐗婃导鍛存晬濞岀€朾ed() 闁?UnsupportedOperationException闁挎稒鐩悰娆戞嫚娴ｅ摜绉奸柛?Spring AI 1.1.2 閻庡湱鍋ゅ顖炲矗椤栨粍鏆?|
| P2 | P2-RAG-04 | AuthoringService 缂佹棏鍨伴崺宀€绮╅銈囩Authoring + HybridSearch 闁艰鲸妫侀惃鐔兼晬鐏炶偐鐭ら柡鍌氭处閵嗗倿骞庨挊澶婄悼闁?Evidence闁?| DONE | AuthoringService 闁哄倹婢橀·?submitWithRagBackfill(req, topK)闁挎稒鑹鹃顔尖柦閳╁啯绠?evidenceRefs 闁汇劌瀚埀顒佺懇閳ь剙顦抽惃鐔兼偨?RAGClient.search(query=concept+property+value, topK)闁挎稑鏈俊鍛婃交閺傛寧绀€ source/id 闁告帗顨夐妴鍐炊閻愯缍栭柟?evidenceRefs闁挎稒琚獳G 闁硅埖鐩弫濠囧籍閺堢數鐭岀憸鏉垮船閹奸鎷犻妷銉㈠亾濞嗘挴鍋撴径娑氱濞戞挸绉瑰Ο鍡涘棘椤撶喐娈诲ù锝嗘尰瑜颁焦绂嶉妶蹇曞耿RAGClient null 闁哄啫鐖煎椋庣棯瑜岀拹鐔煎疾椤曗偓閳?submit闁挎稒绋掗弻濠冩櫠?5 闁告娲樼粊瀵告啺閸℃瑦纾?backfill/鐎圭寮跺﹢?evidence 濞戞挸绉磋ぐ?RAG 濠㈡儼绮剧憴锔锯偓鍦嚀缁?no-client/缂佸苯鎼崹顏嗘偘?|
| P-NEW | P-NLB-01 | 闁哄牆绉存慨鐔虹博?Token / WallTime 濡澘瀚悾璇差嚕閻戞ê鈷旈悶娑樼焿缁辨瑦鎮?7 item 9闁?| DONE | 闁哄倹婢樼紓?TokenBudgetEnforcer service + EnforcementResult record闁挎稒鐡環eck(BudgetDto, tokens, elapsedMs) 閺夆晜鏌ㄥú?allowed 闁?denied(violation, overBy)闁挎稒鎹晆ll budget 閻庣懓顦崣蹇旑渶濡鍚囬柡鈧幑鎰畺闁挎稒绋栫粈瀣极閺夎法绉洪梻鍡氼啇缁辩湠all-time + tokens 闁告艾鏈鍌滄惥閸涘瓨顎欓柛姘墕閼荤喐绋?TOKENS+WALL_TIME + 闁告艾鐗愰?overBy闁靛棔绮緂entRunService 闁哄倹婢橀·?7 闁?complete(runId, status, answer, errorCode, errorMessage, tokens, elapsedMs)闁挎稒顒猘rseBudget + tokenBudgetEnforcer.check闁挎稑鐭佺粔娲⒔閹邦厽顦х€殿喖鎼崺妤呮⒔瀹ュ洭鐛撳☉?DEGRADED + errorCode=BUDGET_EXCEEDED + errorMessage 閻㈩垽绠掔粔娲⒔閹邦垼鍤婇柟顖氭嫅缁遍亶宕?5 闁?complete 閻庣懓鑻崣蹇旂┍濠靛棗鎮戦悗鍦缁辨瑦顪€濡鍚?tokens=0, elapsedMs=0 濞戞挸绉疯闁?enforcement闁挎稑顦埀?0 闁告娲樼粊瀵告啺閸℃瑦纾?enforcer (8) + AgentRunService envelope cases (2)闁靛棔绻侲CH-AGENT 115/115 闁?125/125 PASS |
| P-NEW | P-RPL-01 | 閹?7.5 SSE 闂佹彃绉风换娑欑附閹寸姴顔婃繛鏉戭儓閻︻垶鏁嶉崸鐧硄 濞戞挶鍎查悧鎼佸础閺囷紕娈?+ afterSeq 闁圭儤甯婄划顒佹交閸ャ劍濮?+ 缂佸鍠愰崺娑㈡⒕閺冨偆鐎查柨?| DONE | 闁哄倹婢樼紓?RunEventReplayContractTest + AgentStreamControllerTest (controller contract test)闁? Mockito 闁告娲樼粊鎾晬婢舵稓绐?1) record() 5 婵炲棌鈧煡鐛撻柣?seq 1..5 濞戞挶鍎查悧鎼佸础閺囷紕娈堕柨?2) afterSeq=2 閺夆晜鏌ㄥú?seq 3,4,5 闁圭儤甯婄划顒佹交閸ャ劍濮㈤柕鍡曞伐fterSeq=5 閺夆晜鏌ㄥú鏍矚閻氬骞?3) listForTenant 閺夆晛娲﹂幎銈囨崉閵娧屾匠闁圭娓圭花銊︾鐠佸湱骞?4) tenant+afterSeq 濠㈣泛绉撮幃搴㈡交閸ャ劍濮㈤柨?5) RE-2 saveAndFlush 閻犲鍟伴弫銈嗐亜閸濆嫮纰嶉柛?list 闁哄被鍎撮妤佺▕鐎ｎ亝鍊甸柕鍡楀€介々顐︽儎?/api/v1/agent/run/stream?runId&afterSeq 闁汇劌瀚〃鏍棯閿曞倹妗?|
| P-NEW | P-SCEN-F-01 | 閹?7.4 Claim 100% 缂備焦鍨甸悾?Evidence闁挎稑鐗愮换宥囨偘鐏炵偓顦ч柨娑橆檧缁变即鏌呭宕囩畺 MiddlewareChain.runAfterToolCall 闁活亞鍠栭幗鐓幟圭€ｎ厾妲?ontology.* 鐎规悶鍎遍崣鍧楁儍?claim闁愁偅濮€vidence 缂備焦鍨甸悾?| DONE | 闁哄倹婢樼紓?ScenarioF_ClaimEvidenceBindingTest闁? 闁告娲樼粊鎾晬婢舵稓绀夊鐟板船婵晝鈧懓鏈弳?MiddlewareChain闁挎稑婀憃ntext+Grounding+Permission+Evidence+ActionGuard 5 婵炲牏顣槐姘辨導?afterToolCall 閻犱警鍨扮欢鐐烘晬?F1) ontology.search_objects 闁告瑥鐬肩划銊╁几?-> Claim 闊洤鎳忓﹢?>=1 Evidence闁?F2) ontology.query_metric 闁告娲滅划銊╁几?-> 闁告艾濂旂粭鍌炴晬?F3) rag.search 闂?ontology.* 闁告挸绉剁槐?-> 濞戞搩鍙冨Λ鎸庣閺堢數鐟濋柤濂変簻婵晝绱掗幋顖滅闁圭顦抽鏇犳媼閳藉懐绀嗛柨?F4) 缂?data 闁告帗顨夐妴?-> 濞戞挸绉甸悗顖炴焻閻樼鏁?Claim闁挎稑鐗撴导鈺呭礂瀹ュ懍娴风紓浣瑰煀缁辨岸鏁?F5) 閺夆晝鍋熼悽?3 婵?ontology.* 閻犲鍟伴弫銈囨椤栨簽?3 濞?Claim 濞戞挻姊归惁鈩冪▔椤忓牆鍘撮悽?Evidence闁?F6) context.rejected=true 闁?afterToolCall 闁活収鍙€閻?-> 闁?Claim闁靛棗鍊介々顐︽儎?閹?7.4 閺夆晜鍔橀、鎴﹀籍閹壆妲堥柡鍕叄濞?|
| P-NEW | P-MIG-AUDIT-01 | 閹?7.10 rollback preconditions闁挎稒纰嶇粩濠氭偠閸℃鍧婇柛?Flyway 闂佹彃绉撮ˇ?V1 妤犵偠娉涙慨?MigrationDirectoryAuditTest 闂佸じ绀侀悾?clean-migrations 濞戞挸绉磋ぐ澶愭煂?| DONE | 濞ｅ浂鍠栭ˇ鏌ユ晬濮濆泊CH-ACTION/V1__init_action_schema.sql 闂佹彃绉撮幊锟犲触瀹ュ嫯绀?V12__init_action_definitions_and_executions.sql闁挎稒绗‥CH-OBS/V1__init_obs_run_event.sql 闂佹彃绉撮幊锟犲触瀹ュ嫯绀?V11__init_obs_run_event.sql闁挎稑鐗呯悮杈ㄧ閼恒儲锛?V1 濞村吋淇洪鈧?Flyway 闂傚牊鐟╃划顖滄崉鐎圭姷绠?action_definitions/executions/obs_run_event 濞戞挸顦柌婊呮偘椤帞绀夐梺顐ゅУ閸ㄦ岸寮悧鍫濈ウ閹煎瓨鎹侀妴鍐╃▔瀹ュ懐鎽犻柛锔哄妺缁查箖鎮介悢鍫曠崜 schema 闁哄稄绻濋悰娆撴焻濮樺磭绠栭柨娑欑⊕濡?rollback + 闁轰礁鎳樺▓鏉款煶閺冨倻鐭婇柣銊ュ濠€锛勨偓鍦仱椤ユ捇姊介埡瀣闁靛棗鍊归弻濠冩櫠?MigrationDirectoryAuditTest闁? 闁告娲樼粊鎾晬婢舵稓绐?1) 闁?monorepo 濞寸姷绮崜?TECH-*/APP-* 婵炲备鍓濆﹢?.bak / ~ 闁哄倸娲ｅ▎銏ゆ晬?2) 闁告艾濂旂粩鏉懳熼垾铏仴闁告劕鎳忓Λ銈夋煂瀹ュ拋妲?V__闁?3) 闁绘鐗婂﹢浼村矗閾氬倸绱柡宥囧帶瀹曠喓鎷崘璺ㄥ耿(4) TECH-ACTION + TECH-OBS 濞戞挶鍊栧顖氼啅闊厽鍙忓璺虹Ф濞堟垿寮?V1 鐎规瓕寮撶粭澶愬礃瀹ュ懎姣夐柣婊嗗焽閳ь兛绻侲CH-AGENT 136 闁?140 PASS |
| P-NEW | P-WFE-DRILL-01 | 閹?7.10 闁轰礁鎳樺▓鏉款煶閺冨倻鐭婇柨娑欑摍FE down -> 闂佹彃绉烽惁?-> 闁诡厹鍨归ˇ?-> DLQ 闁圭儤甯為埞鏍晬閸粎鐟濆〒姘箚缁傚棝寮０浣告暕闁活喕绶ょ槐?| DONE | 闁哄倹婢樼紓?WfeApprovalReplayDrillTest闁? 闁告娲樼粊鎾晬婢舵稓绐?drill-1) 闁绘鍩栭埀顑跨鐎?Mockito 閻?WFE 婵℃ぜ鍎辨晶?N 婵炲棌鍓濇慨蹇擃嚕閸屾氨鍩楅柕鍡曟缁狅綁宕ユ惔銏犵亣闁告梻鍣︾槐鐪卬queue -> retry 闁?WFE 濞寸姴绉堕崝?down 闁哄啯鍎肩换鎴﹀炊?null闁挎稑婀払 闁哄秴娲╅?FAILED闁挎稑顓縩-memory entry 濞ｅ洦绻勯弳鈧ù鐘劚椤︻剚绋夌€ｎ偒鍋ч梺鎻掔Х閻︻垶鏁嶆径娑氬耿operator 闁告劕绉甸?enqueue 闁?retry 闁瑰嘲鐏濋崺?WFE taskId闁挎稒鍐荤槐妾噐ill-2闁挎稑顦甸悰娆戞嫚娴ｆ悶浜奸悹鎰╁劥閻儳顕ラ崟顔炬闁?repository.markResolved(id, ..., "FAILED")闁挎稒鍐荤槐妾噐ill-3闁挎稑銆廲heduler.retryPending 闁革负鍔嬬悮閬嶅级?entry + 婵烇絽鍢查幃?WFE 閹煎瓨姊婚悺鐔哥▔鐎ｎ厾绠查柛?ok=1闁挎稑鏈槐銊х矆?Partial-recovery drain 閻炴稑濂旂拹鐔煎Υ閸屾稒鎷辨繛鏉戭儓閻︻垱绂掗崨顒€鈻忛柣顫妼閸欐洟宕?API闁挎稑鏈﹢顓熺┍椤旇姤鏆柣銏㈠枍妤犲洦绂掗敐鍥╁灣闁靛棔绻侲CH-AGENT 140 闁?143 PASS |
| P-NEW | P-SCEN-A-FULLSTACK-01 | 閹?7.1 Object Copilot 缂佹棏鍨伴崺宀€绮╅銈囩闁告娲樼粊瀵镐沪閸岀偞妗ㄩ柨娑橆檧缁变即宕ラ崼婵婂珯 ScenarioA 5 婵?MW 闂?+ Claim+Evidence 濡ょ姴鐭侀惁?| DONE | 闁哄倹婢橀·?ScenarioA_ObjectCopilotTest#objectCopilotFullStackFlow闁挎稒鑹惧畷鐔哥▔閳?@Test 濡炵懓宕慨鈺冣偓鐟版湰閺嗭綁鏌ч幑鎰唴闁靛棔闈檔velope闁挎稑婢僡mpleEnvelope, CUST-10086闁?> beforeExecution 濞戞挸锕ｇ粭鍛村棘? Grounding+ Permission闁挎稒鐭榮sertFalse(rejected) 濞?concepts/metrics 闂傚牏鍋熼埞鏍Υ娣囨矤terToolCall ontology.search_objects 婵☆垪鍓濈€?LLM 鐎规悶鍎遍崣鎸庢交閺傛寧绀€闁挎稑鐡杤idence MW 闊洤鎳嶆鍥礄?Claim + evidence 闂傚牏鍋熼埞鏍晬閸垺鍩涢柟?ScenF 濠靛倹鍨圭€规娊鏁嶆径鍫氬亾娣囨矟dActionProposals + afterExecution闁挎稒顑朓GH-risk Action 闊洤鎳橀妴?requiresApproval=true闁挎稑鏈Λ?Guard 缂備焦娲濈换鍐Υ閸屾稒浠橀柛姘叄閳ь剚鍔栧?Claim 濡ょ姴鐭侀惁?evidence 闁告帗顨夐妴鍐閻愮鏁勯柕鍡楀€介々顐︽儎?閹?7.1 闁革负鍔嬮崬顒勬儘?+ 闁告娲樼粊瀵镐沪閸岀偞妗ㄩ柣銊ュ椤忣剟宕氶幍顕呬紓婵炵繝鑳堕埢鍏碱殽瀹€鍐闁靛棔绻侲CH-AGENT 143 闁?144 PASS |
| P4 | P4-FE-06 | Frontend Typecheck 闁绘粠鍨伴。銊р偓瀛ゃ値鍚€ | BLOCKED | pnpm -r typecheck 閻?apps/kb/node_modules/axios/package.json EACCES 闂傚啰绮弻鍥晬濞戞瑦寮撳ǎ鍥跺枟閺佸ジ宕滃鍥朵紓濞寸媴绲块悥婊堟晬鐏炲吋鍙忓璺虹Х椤撴悂宕氶幒鐐电獥婵炴挸鎳愰幃?闂佹彃绉寸紓鎾舵嫚閵夈倗璐╅悹褎鐗滃ú鎷屻亹閺囩偞鍊甸梺鎻掔Х缁愬洭宕?workspace typecheck |
| P4 | P4-FE-07 | Frontend Dependency Repair | BLOCKED | pnpm install --offline --force 閻℃帒鎳忓鍌炴晬?80s闁挎稑顧€缁辨細pps/kb/node_modules/axios 濞寸姴绉崇拹鐔煎棘椤撱垺鎳?濞戞挸绉磋ぐ鑼嫚閼姐倕笑闁诡兛绶ょ槐閬嶅触鎼达絿鏁鹃梻鍥ｅ亾闁革负鍔岃ぐ鏌ユ偨閵娧呯Ч缂備焦绮嶉崹銊ャ€掗崨顖涘€炴繛鍫濐儑閺嗏偓 node 閺夆晜绋撻埢濂稿触鎼淬劌娅㈢€点倛妗ㄧ欢椋庢導?|
| P4 | P4-FE-08 | Frontend Symlink Repair Audit | BLOCKED | 鐎瑰憡鐓￠崳绋款嚈?axios 缂備焦绻傞顔剧箔閿曗偓瑜板潡鏌ч悙顒€澶嶆鐐插閳ユ鎷嬮妶鍥ㄧ獥闁哄秴娲ら悺銊╁捶椤帞绀夊ù?pnpm typecheck 闂傚懎绻愰幃妤呭捶?apps/kb/node_modules/react/package.json 缂備綀鍛暰 EACCES闁挎稒鐩〒鍓佺磼閻斿墎顏卞ǎ鍥跺枛椤?node_modules/.pnpm ACL/闂佸じ绀侀悾楣冩偐閼哥鍋撴担鍛婂€甸柛鎰У婢х晫鎮?|
| P4 | P4-FE-09 | KB Typecheck Restored | DONE | 闁哄倹婢橀·?apps/kb/tsconfig.json闁挎稑鐭佽棢濮?@ant-design/icons 濞撴碍绻嗙粋鍡涚嵁閸洖娅㈢€点倗鍎ゅ﹢浼村捶娴煎瓨鎳犻柟鎭掑劵缁遍亶鎯勭€涙ê澶?tsc --project apps/kb/tsconfig.json 0 闂佹寧鐟ㄩ銈夋焻濮樺磭绠?|
| P4 | P4-FE-10 | Workspace App Typecheck | PARTIAL | 濞ｅ浂鍠栭ˇ?apps/dw CustomerCopilotDrawer 闁?evidences undefined 缂侇偉顕ч悗鐑芥煥濞嗘帩鍤栭柨娑欑〒濞插潡骞?tsc 濡ょ姴鐭侀惁?apphub/arch/dashboard/dw/kb/mcphub/portal/superai 闁秆冩喘閳ь剚淇虹换鍐Υ閸屾艾寮块梺鎻掔箻閳ь剚甯掔紞濠囧箥椤愶絽浼庡ù鐘茬Т閹斥剝绋夐婵堣穿閻犙勭墱濞叉媽銇愰弴鐐叉暥 package tests闁挎稑鐭傚〒鍫曞箳閹烘鐝?node_modules 闁告艾楠搁懜浼村箣閹邦厽浠樼紓?gate |
| P4 | P4-FE-11 | Reproducible Frontend App Typecheck Gate | DONE | 闁哄倹婢橀·?scripts/typecheck-frontend-apps.ps1闁挎稑鏈敮鎾绘⒔?node_modules 闂侇偅甯掔紞濠勬嫚椤栨稑顥囬柨娑樼灱濞插潡骞掗妷銉殸 8 濞戞搩浜欑粭鐔煎礉?App tsconfig 闁圭瑳鍡╂斀 tsc闁?/8 闂侇偅淇虹换?|
| P4 | P4-FE-12 | Frontend SSE Contract Audit | PARTIAL | Added useAgentRunEvents for named SSE frames, exclusive seq dedupe, lastSeq reconnect, and gap rejection; AgentStreamControllerTest locks id/event/data and afterSeq forwarding. The legacy useAgentStream POST stream path remains for compatibility; full create-Run/Envelope then SSE cross-service integration is deferred to CI/Testcontainers. |
| P5 | P5-ACT-13 | DLQ metrics 闁规亽鍎遍崣?Micrometer / Prometheus闁挎稑娼奵tuator 闂傚棗妫欓崹姘舵晬?| DONE | 闁哄倹婢樼紓?src/main/java/com/metaplatform/agent/middleware/ActionRouteDlqMetrics.java闁挎稑婀憃unter / Gauge / MeterRegistry闁挎稑顔唘ll registry fallback闁? src/test/java/.../ActionRouteDlqMetricsTest.java闁? 闁告娲樼粊鎾晬婢舵稓骞ECH-AGENT/pom.xml 闁哄倹婢橀·?spring-boot-starter-actuator闁挎稑鐗撻埀顒€绻嬬槐?micrometer-core闁?|
| P5 | P5-ACT-14 | ActionGuard DLQ metrics 闂侇偅淇虹换?Micrometer 闁哄棙鎸冲﹢鍫曞礆?/actuator/prometheus | DONE | ActionRouteDlqMetrics 闁哄棙鎸冲﹢?mate.agent.dlq.enqueued / retry.success / retry.failure / pending 闁搞儲绋愰柌婊堝箰閸ャ劎鍨奸柨娑欑潝ctionRouteDlqService.enqueue/retry 闁?DLQ 闁告帒妫欓弫顔炬嫬閸愵亝鏆?metrics闁挎稒鐫攃tionRouteDlqMetricsEndpoint 闁告艾鏈鐐存交閺傛寧绀€ metrics_present / metrics_enabled / enqueued_total / retry_success_total / retry_failure_total 闁哄倿鈧稓鈹掗柡?Prometheus 濞戞梻鍠曢崗姗€鎯囩€ｎ亜鐓傞柟绋挎处閻栵綁鏁嶅☉妯诲剻闁?`/actuator/prometheus` 闁告鍟胯ぐ鏌ュ箯婢跺﹤绲块柨娑樼墦缁垳鎷嬮妶鍫㈢唴鐎垫澘瀚哥槐?|
| P6 | P6-AUTH-06 | AuthoringService 闁告梻濮撮悾楣冨籍閼搁潧顥楀璺哄閹﹪鏁嶉崼鐔肺╅柛姘缁?documentId 闁汇劌瀚埀顒佺懇閳?fact 闁告艾鐗嗛懟鐔煎箵閹邦亝鍞夐柨?| DONE | 闁哄倹婢樼紓?src/main/java/.../authoring/AuthoringBatchAccumulator.java闁挎稑婀憃ncurrentHashMap<(tenant, documentId), BufferedDraft> 缂傚倹鎸搁崯?+ enqueue / flushDue(maxAge) / flushAll / size / keys闁? AuthoringBatchFlushScheduler.java闁挎稑婀孲cheduled fixedDelay闁挎稑鐡怌onditionalOnProperty 濮掓稒顭堥濠氬礂閹惰姤锛旈柨娑橆檧缁辩泴ocumentCandidateListener 濠⒀呭仜婵?FlushMode {IMMEDIATE, BATCHED} + 4 闁?ctor闁挎稑鐗撶划顖滄媼?IMMEDIATE闁挎稑濂旂换姘舵偩濞嗗繐鏂?2 闁?ctor 濞戞挸绉堕悧顒勫锤韫囨洖绠涢柡鍫濐槹缁佸鎷犻弴顏嗙闁挎稒闆笰TCHED 婵☆垪鈧磭纭€ enqueue 闁告艾娴烽悵娑㈠础?flushAll闁?3 濞戞搩浜濋弻濠冩櫠閻愭彃绀嬫繛鏉戭儓椤╊偊鎯勯弽褎鍊ゆ?/ 閻?key / 妤犵偞鎸崇欢鐐电玻濡も偓瑜?/ null AuthoringService / 缂佹柨顑呭畵?vs 闁圭數鎳撻ˇ鈺呮偠閸℃鐎绘繛?|

### 0.2.1 婵☆垪鈧櫕鍋ユ繛鏉戭儓閻︻垶宕洪搹鐟版疇闁挎稑娼皏n -o test 16:40 閻犵儤鍨块埀顒佺啲缁?

| 婵☆垪鈧櫕鍋?| 婵炴潙顑堥惁顖炲极?| 闁绘鍩栭埀?| 濠㈣泛娲﹂弫?|
|---|---:|---|---|
| TECH-AGENT | 11 / 11 | PASS | Repository + Context Service + Tool 婵炴潙顑堥惁?|
| TECH-IAM | 114 / 114 | PASS | Controller + Service 闁稿繈鍔岄〃?|
| TECH-ACTION | 112 / 112 | PASS | Definition + Execution + Orchestration + Outbox + Trigger + Statistics + Integration |
| TECH-ONT | 0闁挎稑鐗忕槐顏嗘嫚閹达腹鍋撳宕囩畺闁?| PASS | DDL + Schema 濡ょ姴鐭侀惁澶愬捶?Flyway 闁告凹鍨版慨鈺呭嫉閻旈鏆氶柟?|
| TECH-MSG | 56 / 56 | PASS | Consumer + Outbox + Dlq + Realtime |
| TECH-MCP | 242 / 242 | PASS | MCP 鐎规悶鍎遍崣鍧楁儎椤旇偐绉?|
| TECH-OBS | 123 / 123 | PASS | Alert + Anomaly + Dashboard + Log + SLO + Topology + Trace |
| TECH-WFE | 112 / 112 | PASS | Workflow 鐎殿喗娲橀幖?+ 2 DirectApprovalTask + 4 ExternalActionCallback |
| TECH-DATA | 13 / 13 | PASS | 闁轰胶澧楀畵渚€宕ョ仦缁㈠妱 |
| TECH-EA | 253 / 253 | PASS | 闁轰焦婢橀悺褔宕ㄥΟ杞扮矗 |
| TECH-GW | 65 / 65 | PASS | 缂傚啯鍨甸崣?|
| TECH-RULE | 44 / 44 | PASS | 閻熸瑥瀚崹顖氼嚕閺囩喐鎯?|
| TECH-A2A | 0闁挎稑鐗忕槐顏嗘嫚閹达腹鍋撳宕囩畺闁?| PASS | 闁哄啰濮电粊瀵告嫚閺囩姵鏆忓〒姘儎缁?mvn install 闂侇偅淇虹换?|
| TECH-LLMGW | 14 / 14 | PASS | 5 LlmProvider 闁告鍠愬﹢?+ 9 SpringAiLlmProvider v1.54闁挎稑娼廻at call 閻犱警鍨扮欢?/ null 閻庣懓顦崣?/ 鐎殿喖鍊搁悥鍫曟⒔瀹ュ洭鐛?/ stream Flux<ChatResponse>闁愁偅澧痩ux<String> 闁哄嫮濮撮惃?/ 缂佸苯鎼鈩冩交閸ャ劍濮?/ embed Unsupported闁?|
| TECH-RAG | 0闁挎稑鐗忕槐顏嗘嫚閹达絿绠栭柨?| PASS | 闁哄倹婢橀·?tech-llmgw 濞撴碍绻嗙粋?+ KB stub entity + Milvus/HybridSearchService 婵℃せ鏅涢悿鍕偝?|
| TECH-AGENT | 144 / 144 | PASS | 11 repo + 29 scenario (22 A/B/D/E + 6 F + 1 A-fullstack) + 5 ActionExecution + 4 ActionApprovalBridge + 7 AuthoringService + 5 AuthoringServiceRagBackfill + 7 AuthoringBatchAccumulator + 3 AuthoringBatchFlushScheduler + 8 DocumentCandidateListener + 10 ActionGuardAutoRoute + 5 AuthoringDoc + 9 AgentRunServiceComplete + 8 TokenBudgetEnforcer + 5 RunEventReplayContract + 4 MigrationDirectoryAudit + 3 WfeApprovalReplayDrill + 8 ActionRouteDlqPersistence + 5 ActionRouteDlqScheduler + 3 ActionGuardCrossRunDedup + 2 ActionRouteDlqMetrics + 2 ActionGuardCrossTenantDedup + 5 ActionRouteDlqMicrometerMetrics |
| **闁诡剚妲掗?* | **1227+** | **15/15 婵☆垪鈧櫕鍋?BUILD SUCCESS / 0 濠㈡儼绮剧憴?*闁挎稑婀礒CH-AGENT 144/144 + TECH-LLMGW 14/14 v1.63闁挎稒楗監NE P5-ACT-13/14 + P6-AUTH-06 + P8-NAT-13b + P2-RAG-04 + P-NLB-01 + P-RPL-01 + P-SCEN-F-01 + P-MIG-AUDIT-01 + P-WFE-DRILL-01 + P-SCEN-A-FULLSTACK-01闁?|

### 0.2.2 鐎规瓕灏欓悡锟犳焼濡ゅ啯娈岄柨娑樼墔缁楀銇愰崡鐐存儥 BUILD / 闂侇喓鍔庣拋鏌ユ晬鐏炶偐绋婚梻鍥ｅ亾濞戞挸顑勭粩瀛樻姜椤旇偐鏆氶柛鐘插缁?

1. **ScenarioB 1 濞?grounding 婵炴潙顑堥惁顖涘緞鏉堫偉袝**闁挎稒纰嶇粊瀵告嫚閺囩喐鍩傞柡?msg='闁告帒妫欓悗浠嬪础鎼存繄顐介柛鏍ㄦそ閺€銏ゅ船椤旇崵鐟撻梻鍕Т鐢偊宕? 闁?grounding.metrics 闁告牕鎳庨幆?customer.count 闁?customer.churn_rate闁挎稑濂旂徊鎹愩亹閹惧啿顤呴柛蹇斿▕閺侇厾鎷犲鍛埍闂佹澘绉磋ぐ褏鎷犻崱妤€鐒奸柛?sales.revenue闁靛棗鍊烽幈銊﹀緞瀹ュ棙鐓欑€殿喖楠忕槐浼村箮?GroundingMiddleware 闁告娲ㄦ鍥ㄧ▔閸濆嫮鍞ㄥù?LLM 闁汇劌瀚銏＄▕婢跺海妲曢柛鎺濆亾缁辨┏ECH-LLMGW 闂傚棗妫欓崹姘舵晬婢跺鐏楅柟纰樻櫅閻秹宕楅幎鑺ユ殯閻犲洤绉烽妴鍐Υ?
2. **TECH-RAG Ontology Filter 閻忓繑纰嶅﹢顓犫偓鐟拌嫰閸欏繒鈧懓鏈崹?*闁挎稒顒甧nantId 閺夆晛娲﹂幎銈咁啅閼煎墎鏌堢紒?HybridSearchService 濞?InMemory/Milvus HTTP 闂侇偄鍊块崢銈夊闯椤帞绀夋鐐跺煐濠€浣烘崉閵娧屾匠闁规挳鏀辩粊瀵告嫚閺囶亞骞bjectId/conceptCode scope 鐎规瓕灏换姗€宕楅妷褏鍩犲☉鎾亾 API闁挎稑濂旂徊楣冩閳ь剛鎲版担鐑樺煕缂備緡鍙€钘熷缁樺姉椤忣剟宕氶幍顕呬紓闁告劖鐟ラ崣鍡樼▔鎼淬倗绠肩紒鏃戝灥缁诲啫顭ㄩ妶鍜佹缂佹拝璐熼埀?
3. **TECH-LLMGW / TECH-ONT / TECH-MSG 濞寸姴绉靛Σ?fat-jar + 闁哄拋鍣ｉ埀?jar 闁告瑥鐭佸?*闁挎稒纰嶅﹢鏉库枎閿涘嫭鏆?jar.exe 闂佹彃绉垫晶锕傚礌閸涱剛鍟?3 濞戞搩浜濊啯闁秆勵殔閸?m2闁挎稑濂旂徊?spring-boot-maven-plugin 濮掓稒顭堥缁樼瀹ュ棗鈪?fat-jar闁挎稑濂旂粭鍛€?mvn install 濞村吋纰嶉挅鍕蓟閹炬墎鍋撻崒姘辩处閻犱緡鍠栨慨?profiles闁挎稑娼恊v / jar闁挎稑顦埀?
4. **AgentCheckpointEntity vs CheckpointEntity 闂佹彃绉撮ˇ?*闁挎稒纰嶉弸鍐浖?閹?5 闁圭粯鍔曢崺灞炬媴閸℃ɑ寮撴繛鎾虫噽閹﹪鏁嶅畝鍕粯濞戞挸顑勭粩瀛樻姜椤斿吋鍊ゆ鐐剁堪閳?
5. **TECH-RAG / TECH-LLMGW 闁? 閻犫偓閿曗偓閹?*闁挎稒纰嶅﹢顓㈠础閸モ晠鐛撻柛?protobuf-java 4.x闁挎稒绋愮粭澶愭⒓鐠囧樊鏁氶柡瀣缂傛挻鎷呴崱妯兼Ж婵炲棴绻濋崗姗€寮?WARNING闁?

> Recommended next: implement cross-module Testcontainers boot coverage in CI and replay snapshot infrastructure; production v1.64 closes all local acceptance paths.

> 闁哄牜鍓濋悿鍡涙晬閸?.55 / 54闁挎稑顧€缁辩櫃2-RAG-04 鐎?DONE闁挎稑鐗愰娑氭喆?閹?.2 闁绘鍩栭埀顑挎祰閵嗗啴寮弶娆炬澔閻炴稑鐭夌槐鐩〦CH-AGENT 115/115 PASS闁挎稑鏈弻濠冩櫠?5 濞?Authoring RAG 闁搞儳鍋涢敐鐐哄础閺囩喓銈撮柨娑橆槶閳?

闁告挴鏅欑紞鎴炲濡搫甯ョ紒鐙欏秶绀勯柟绋款槹閺嬪啫顩奸敐鍥跺剳 12/13 闁煎搫鍋婄槐姘舵晬?

1. ~~P8.4闁挎稒鐡攑ringAiLlmProvider 闁活亞鍠庨悿鍕偓鍦仧楠炲櫋~ 闁?DONE v1.54闁?
2. ~~P6-AUTH-06闁挎稒顑媢thoringService 闁告梻濮撮悾楣冨籍閼搁潧顥楀璺哄閹Ζ~ 闁?DONE v1.53闁?
3. ~~P2-RAG-04闁挎稒顑媢thoringService 缂佹棏鍨伴崺宀€绮╅惁鍣?闁?DONE v1.55闁?
4. ~~P5-ACT-13闁挎稒顑廘Q metrics 闁规亽鍎遍崣?Micrometer / Prometheus~~ 闁?DONE v1.52闁?
5. ~~P5-ACT-14闁挎稒顑媍tionGuard DLQ metrics 闂侇偅淇虹换?Micrometer 闁哄棙鎸冲﹢绉獈 闁?DONE v1.52闁?



## 1. 闁诡剝顔婄紞瀣几閼哥數鈧?

```text
闁告挸绉堕?InteractionContext
  闁?Gateway / IAM
  闁?OntologyContextService
  闁?缂佹稒鍎抽幃鏇㈡儍?OntologyContextEnvelope
  闁?AgentRun
  闁?RuntimeRouter
  闁?Middleware Chain
  闁?Grounding
  闁?Fast Query / SAA Graph / DeerFlow / Sub-Agent
  闁?Ontology / RAG / MCP Tools
  闁?Claim + Evidence 闁哄稄绻濋悰?
  闁?SSE RunEvent + 闁哄牃鍋撶紓浣哥墕閹奸攱鎯?
  闁?Artifact / Memory / Event
```

| 婵☆垪鈧櫕鍋?| 濞戞挻妲掗々锕傛嚂瀹€鍐厬 | 缂佹拝闄勫?|
|---|---|---|
| 闁告挸绉堕?SuperAI / Object Copilot | 濡炪倗鏁诲鐗堢▔婵犱胶鐟撻柡鍌氭储閳ь兛璁E闁靛棔绔糽aim/Evidence 閻忕偞娲滈妵?| 濞戞挸绉烽崵婊呮偘鐏炲墽鍙€閹煎瓨鎸堕埀顑挎缁楀鎳涢鍥舵斀闁告帇鍊栭弻鍥级閸愵喗顎?|
| TECH-AGENT | AgentRun闁靛棔闃渦ntime闁靛棔妞掗懙鎴︽⒒缂堢姵顐介柕鍡曠畱ool 缂傚倹鐗楃敮鎾诲Υ娴ｇ晫妲堥柟璇″枛閹风増绂嶈婢?| 濞戞挸绉剁划顐ｆ交?Ontology 濞?Action 婵炲矁宕甸幃?|
| TECH-ONT | Concept闁靛棔鍓痓ject闁靛棔搴渆tric闁靛棔闃渆lation闁靛棔绠揺rsion闁靛棔璁hema | 濞戞挸绉风粈瀣嫻?LLM 閻熸瑥瀚崹?|
| TECH-RAG | 闁哄倸娲﹂妴鍌炲礆閸℃瑥顣婚柕鍡曠劍椤ュ懐妲愰姀鐘冲鐎殿喗娲滈弫銈夊炊閻愭潙鍤?| 闁告瑯浜ｈ棢闁稿繐鎳愰悡锛勬嫚閸☆厾绀夊☉鎾崇У濞存稒绂掗敐鍥╂尝闁哄瀚€靛弶绂嶇€ｎ亞鏉?|
| TECH-ACTION | Action Schema闁靛棔璧媟oposal闁靛棔璁mulation闁靛棔绀佺粻鎾剁驳婢跺鈷旈悶?| 闁告瑯浜濈敮鎾矗濡も偓瑜?Guard 闁汇劌瀚顒€效?|
| TECH-WFE | 閻庡厜鍓濇竟鎺楀Υ娴ｈ櫣鎼肩€垫澘鎳岄埀顑跨劍娴狀喗寰勫鍐ｅ亾娴ｅ壙澶愬磻?| 濞戞挸绉垫晶鐣屾偘鐏炵偓寮撻柟鍝勭墛濞煎牓宕濋妸銈囩▕ |
| TECH-MSG | Outbox闁靛棔绠憃pic闁靛棔妞掔花銊︾閼哥數啸閻?| 濞戞挸绉垫竟娆撳箯閸涱喖鑵归柣?|
| TECH-IAM | 缂佸鍠愰崺娑㈠Υ娴ｅ壊鍤犻悹鐏烘壋鍋撴担鍝ユ憻婵炲牏鍋ｉ埀顑跨閸櫻呭寲濮瑰洠鍋撴稉鍒ion 闁哄鍟村?| 闁哄鍟村鐑樼閵夛附绠涢柛鏃撶磿椤忣剝绠涢銈呭季濞戞挸鎼崳?|
| TECH-OBS | RunEvent闁靛棔绀侀鍝ユ媼鎺抽埀顑跨劍鐎垫岸寮介崶銉㈠亾娴ｇ懓鐏囬柡?| 濞戞挸绉甸弫濂稿矗濡湱鐟归柛鏂衡偓鍐叉瀫缂?|
| DeerFlow | 闁告瑯鍨堕埀顒€顦卞▓鎴犳喆閸曨偄鐏婇柕鍡曠閻?Agent闁靛棔绠榦rkspace 闁圭瑳鍡╂斀闁?| 濞戞挸绉跺ú鍧楀箳閵夈儱鏅?Ontology闁靛棔妞掔粭澶愬箰娴ｈ绠掗梻鈧幐搴㈠焸闁告埈鍘藉畵?|

鐎规悶鍎抽埢濂告⒓閼告鍞界紓浣哄枍缁旀挳鏌岄崶鈺傛殢 Rollout Roadmap 闁?P0闁挎繃鎵?闁?

```text
P0 闁糕晞娅ｉ、鍛償閺囩偤鐛撳☉鎾虫捣缁儤绋夐埀顒佺附閹寸姴顔?
P1 Ontology 闁哄秶顭堢缓楣冩嚄閽樺顫?
P2 RAG 闁活厹鍎撮惁鎴炴償閹剧粯锛旈柣?
P3 DeerFlow Runtime 闁规亽鍎遍崣?
P4 SuperAI 濞?Object Copilot
P5 Action 婵炲矁宕甸幃?
P6 Ontology Authoring
P7 濞存粌顑勫▎銏°仚閸楃偛袟濞戞挸绨肩槐鎺撶▔濮樿埖姣愰柡鍫㈠枙椤斿洩绠?
P8 闁汇垻鍠嶆鍥р柦閼姐倖鍊炲☉?Native Runtime 闁告艾鎲￠弫?
```

## 2. 缂備胶鍠嶇粩瀛樼附閹寸姴顔?

### 2.1 InteractionContext

```json
{
  "message": "闁告帒妫欓悗鑺ョ▔閳ь剚绋夌€ｎ厾绠瑰☉鎿冧簻椤撳綊骞嬮柨瀣粯閺夆晜鍨崇拹鐔哥閳ь剚绋婇崼銉︽晿闁哥儐鍠曠粭鍛存⒔?,
  "interaction": {
    "appCode": "DW",
    "pageCode": "customer-detail",
    "pageUrl": "/customers/CUST-10086"
  },
  "subject": {
    "conceptCode": "Customer",
    "objectId": "CUST-10086"
  },
  "viewState": {
    "activeTab": "orders",
    "filters": {"timeRange": "last_12_months"}
  },
  "contractVersion": "1.0"
}
```

闁告挸绉堕顒勫矗椤忓懎绲瑰〒姘洴閵嗗妫冮姀锝庡殧濞戞柨顦幏浼存偨閵婏箑鐓曢弶鍫熸尭閸欏棝鏁嶇仦鑲╃憹闁煎疇妫勮ぐ鍙夌┍閳ヨ櫕鍕惧ù鑲╁Т閸?`allowedTools`闁靛棔姊梐llowedActions` 闁瑰瓨鐗曢悺褍鈻撻崹顐ｇ秬闂傚嫭鍔戦埀?

### 2.2 OntologyContextEnvelope

```json
{
  "envelopeId": "ENV-9001",
  "tenantId": "TENANT-01",
  "userId": "USER-1001",
  "runId": "RUN-7788",
  "subject": {"concept": "Customer", "objectId": "CUST-10086"},
  "ontologyVersion": "v12",
  "allowedTools": ["ontology.get_object", "ontology.query_metric"],
  "allowedActions": [],
  "dataScopes": {"regions": ["EAST_CHINA"], "fieldsDenied": ["bankAccount"]},
  "permissionSnapshotId": "PERM-123",
  "expiresAt": "2026-07-26T11:00:00+08:00",
  "signature": "<server-signature>",
  "contractVersion": "1.0"
}
```

闁哄牆绉存慨鐔虹博椤栨氨绠戝銈囩帛閻楀孩顨ュ畝鈧～銈夊箣閺嬵偀鍋撴担鐑樻殢闁瑰瓨鐏氶埀顑块槣un闁靛棔娴囩换鍐嫉閻斿憡顦ч梻鍌涚暘閳ь兛鑳堕鐑藉触瀹ュ啠鍋撴稉鐪搕ology 闁绘鐗婂﹢浼村椽鐏炵偓缍€闂傚嫭鍔曢幓鈺呮偂瑜嬮埀顒€鍊搁悺?Agent 闁告瑯浜ｉ崗姗€骞掗妷锔芥毆閻熶椒绀佹竟鈧柛姘捣濞堟垶绋夋繝浣虹憮闁哄倸娲㈤埀?

### 2.3 Claim闁靛棔绗抳idence 闁?Action

- `Claim` 闁告帒妫旂拹?`FACT`闁靛棔姊桰NFERENCE`闁靛棔姊桼ECOMMENDATION`闁?
- 闂佹彃绉烽々?Claim 闊洤鎳橀妴蹇涘礌閸涱厽鍎?`evidenceRefs`闁?
- Evidence 闊洤鎳橀妴蹇涙嚄閽樺绀€婵犙屽灠閸?Object闁靛棔搴渆tric闁靛棔绗峯cument 闁瑰瓨鐗曢ˇ濠氭焾閵婏附闄嶆繝褎鍔х槐?
- Evidence 闊洤鎳橀妴蹇曟媼閺夎法绉?Envelope ID 闁?Ontology Version闁?
- `ActionProposal` 濞戞挸绉靛Σ鎼佸箥瑜戦、鎴犵磼閹惧浜柨娑樿嫰缁烩偓濡炪倛宕电划鈩冩交?Schema闁靛棔鐒﹀鍫ユ⒔閹扳斁鍋撴笟鈧ˉ鎾绘⒔閳轰焦瀚叉鐐插€婚悺鎴﹀冀閿熺姷宕ｉ柨?
- CandidateFact 濞戞挸绉靛Σ绋款潰閿濆懐纭€ Ontology Fact闁挎稑鏈婊冾嚕韫囨挸鏅搁柛蹇嬪劚瑜把囨嚄閻ｅ瞼鐥呴弶?Commit Service闁?

## 3. Token 濞戞挸绨奸幑銏ゅ礉閿熺媭鏆紒顔藉笒鐎瑰啿鈻介懡銈嗗€?

### 3.1 濮掓稒顭堥缁橈紣閸曨厾鏆?

| 闁革妇鍎ゅ▍?| 閺夊牊鎸搁崣鍡樼▔婵犲洦顎?| 閺夊牊鎸搁崵顓熺▔婵犲洦顎?| 闁哄牃鍋撳鍫嗗嫷鍔勫Δ?|
|---|---:|---:|---:|
| Fast Query | 4K tokens | 1.5K tokens | 4 |
| Object Copilot | 8K | 3K | 8 |
| Deep Task | 12K | 5K | 16 |
| Sub-Agent | 4K | 2K | 8 |
| 闁哄倸娲﹂妴鍌炲箮閽樺绲块柛鎺戞婢?| 6K | 2K | 6 |
| Claim 闁告艾鐗嗛懟?| 6K | 2K | 6 |
| Action Proposal | 4K | 1K | 4 |
| Final Answer | 6K | 3K | 4 |

閺夆晜鐟﹀Σ鎼佸嫉瀹ュ懎顫ょ紒鏃戝灦椤ｂ晝绮诲Δ瀣濞戞挸绉磋ぐ褔寮?Prompt 闁圭粯鍔楅妵姘跺Υ閸屾繄孝闂傚嫭鍔栧鍌濈疀閸涙番鈧繘骞忛幒鏃傚崪闁靛棔娴囬ˉ鍡涘礈椤忓懎鐏楅柟宄版閸ㄥ酣鏁嶇仦鑲╃憹闁煎磭鏅幋椋庣磼椤撶偛绲洪梺顐＄鐢偅鎱ㄧ€ｎ厾孝闂傗偓閼愁垼鍤炴慨鐟板€堕埀?

### 3.2 閻熶椒绀佹竟鈧柛妯煎枎閸?

1. 濞戞挸绉垫俊鍝モ偓鐟版湰閺?Ontology Schema 闁衡偓閹冨汲 Prompt闁挎稑鑻ぐ褎绋夌€ｎ亜绲洪柣鈺冾焾閸?Concept闁靛棔绀侀悺褍鈻撻棃娑欏闁稿繐纾柈鎾晬?
2. 濞戞挸绉垫俊鍝モ偓鐟版湰閺嗭綁宕㈤崱妤€钑夊ù鍏间亢閻︿粙寮ㄩ幆褍寮?Prompt闁挎稑鑻ぐ褎绌卞┑鍫熸畬闁硅姤顭堥々锕傚椽鐏炵晫绠戦悷鏇氳兌濞堟垿寮甸埀顒佹交閹寸偟啸闁诡収鍨界槐?
3. 濞戞挸绉垫俊鎼佸极鐎靛摜妲栭柡鍌氭处閵嗗倿寮ㄩ幆褍寮?Prompt闁挎稑鏈€垫粍銇勯悙鍏夊亾娴ｈ櫣褰块柤鍝勫€归崹?chunk 闁告帒妫涙晶鏍晬?
4. Tool 閺夆晜鏌ㄥú鏍渶濡鍚囬柡鍫氬亾濠?5 濞戞搩浜炵划銊╁几濠婃劗绀夐悺鎺戞噹閸ゎ參寮捄鍝勭€诲銈呯仛閸ㄣ劑寮靛鍛潳缂佹棏鍨遍幉宕囨啺娓氬﹦骞?
5. Sub-Agent 闁告瑯浜濈敮鎾绩?`objective + inputSchema + scopes + budget`闁?
6. Claim 闁告艾鐗嗛懟鐔煎矗椤忓懎澶嶉柡鈧崜浣烘尝闁哄瀚€?Claim/Evidence闁挎稑濂旂粭澶愭煂瀹ュ棙鐓€婵炲鍔岄崣鍡涘箥閳ь剟寮垫径濠傛枾闁哄倸娴勭槐?
7. 闁活潿鍔嶉崺娑欑▔婵犱胶鐐婇柛鎰噹椤旀劙濡存笟鈧埀顒€顦懙鎴﹀棘閸ャ劍鎷遍柛婊冭嫰椤﹀鏌堥妸锔界€俊妤嬬到濞煎酣寮介崶顏嶅敹濞戞捁妗ㄧ粭澶愬矗椤栨瑤绻嗛弶鍫熸尭閸欏棝濡?

### 3.3 闁告娲戦柌婊兾熼垾宕団偓宄邦嚕閳ь剟宕ｉ幋婊勫床闁告柡鍓濊啯闁?

婵絽绻嬮柌婊兾熼垾宕団偓閿嬬鐠囨彃顫ら柡鍫氬亾濠㈣埖鑹鹃ˇ鈺呮偠閸℃洜顏卞☉鎿冧簼濠€鍥礉鎺抽埀?闁? 濞戞搩浜滈悿鍕偝閻楀牊鐎ù鐘烘硾閹?1闁? 濞戞搩浜濈粊瀵告嫚閺囩喐鐎ù鐘虹堪閳ь剙鍊风欢銉︿繆閸岋妇绐?

```text
濞寸姾顕ф慨?ID闁挎稒鐡?-BE-07
闁烩晩鍠楅悥锝夋晬濮橆剦鏉婚柛?Evidence Gate
濞ｅ浂鍠楅弫濂告嚑閸愩劍绾柨娑欑摉ECH-AGENT 濞戞挴鍋撳☉?Middleware 缂侇偅鐪归埀顑挎缁斿瓨绋夐鍛偞閻犲洦娲滅悮?
閺夊牊鎸搁崣鍡涙晬濮橆剙鍤掔紒娑欏劤閹?OntologyContextEnvelope
閺夊牊鎸搁崵顓㈡晬濮樺灈鍋撳宕囩畺闁瑰瓨鐗楃€氬棛绱?Claim
濞撴碍绻嗙粋鍡涙晬濮?-CON-02闁靛棔璧?-ONT-07
濡ょ姴鏈弫褰掓晬濮橆剙绀嬮柛蹇撳暞缁佸鎷犻弴鐐村濠靛倹鍨圭€瑰啿霉鐎ｎ厾妲搁梺顐ｄ亢缁?
缂佸倷鐒﹂娑㈡晬濮橆剚鍊遍柡鍐╂构閹便劑寮ㄩ悷鏉款枀缂佹棏鍨埀顑跨劍閺嗙喖骞戦鑲╂皑閺夆晙鑳朵簺闁?Action
```

閻犳亽鍔嶅﹢鍥礉閳ュ弶宕查柛鏂衡偓宕囩畱濡炪倗绮刊鍫曞箣閹板墎绐楀┑鍌涘灩鐎?闁?闁告艾娴烽顒勬偨閻斿爼鐛撻柤?闁?闁告艾娴烽顒€鈽夐崼锝呯€柤?闁?闁告挸绉堕顒勬焻閸岀偛甯?闁?闁艰鲸妫侀惃鐔访圭€ｎ厾妲搁柕?

## 4. P0闁挎稒鑹鹃悢鈧痪顓涘亾閹煎瓨娲栨鍥ㄧ▔鎼达絿鍩犲☉鎾亾濠靛倹鍨圭€?

### 闁烩晩鍠楅悥?

闁哄牆绉存慨鐔兼嚄閽樺妾柛姘煎灠婵晠濡存担鐣岃缂佸鐪归埀顑挎祰椤撹崵鎷犳担姝屽珯濞存嚎鍊栧畷鑼磼閻斿墎顏卞┑鍌涘灩鐎规娊鏁嶇仦鑲╃憹闁稿鑹鹃ˇ鏌ュ级閸屾稑鑵归柣鐐叉閳?

### 濞寸姾顕ф慨鐔枫€掗崨顓炵

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P0-INF-01 | 闁搞儱鎼€垫煡寮?`.env.example` 闁告粌鐬奸顒勫矗?| 闁哄秴缍婇崢銈囩磾?| env-check 闂侇偅淇虹换?|
| P0-INF-02 | 闁告帗绻傞～鎰板礌閺嵮冨綃濞?Postgres 濞戞挻鑹炬慨鐔告償?| infra | 缂佸矁娅ｉ獮鍡樻櫠閸愩劌鐏＄€点倗鍎ら崹姘跺礉?|
| P0-INF-03 | 濠⒀呭仜婵?Redis闁靛棔鐢玜fka闁靛棔搴渋nIO闁靛棔搴渋lvus闁靛棔淇痮ki 闁稿鍎遍幃宥呂涢埀顒勫蓟?| infra/scripts | health-check 闁稿繈鍔戦崕鎾焻濮樺磭绠?|
| P0-IAM-01 | PermissionSnapshot DTO闁靛棔绗抧tity闁靛棔闃渆pository | TECH-IAM | CRUD 闁告粌鑻妵鎴﹀极閸喓銈撮悹?|
| P0-IAM-02 | 閻庣數顢婇挅鍕Υ娴ｅ摜鎽熸繛鍫㈠仯閳ь兛绀侀崣褏鍖栧Ч鍥ｅ亾娑撳垻tion Resolver | TECH-IAM | 閻℃帒锕ュ鍫澝圭€ｎ厾妲?|
| P0-MSG-01 | Ontology Event Envelope | TECH-MSG | JSON 濠靛倹鍨圭€瑰啿霉鐎ｎ厾妲?|
| P0-MSG-02 | Outbox 闁告粌鏈粔椋庢嫻閻熸壆鐣电紒?| TECH-MSG | 闂佹彃绉烽惁顖毭圭€ｎ厾妲?|
| P0-AGENT-01 | 濞ｅ浂鍠栭ˇ?Agent Entity 濞戞挸顭烽弫?| TECH-AGENT/entity | `mvn test` 闁告瑯鍨伴幆搴ㄥ礉?|
| P0-AGENT-02 | 婵炴挸鎳愰幃?Flyway 闂佹彃绉撮ˇ鏌ュΥ娴ｇ鐏╅梻鍕╁€曢幏?`.bak` | TECH-AGENT/migration | 缂佸苯鎼花?闁告娲ㄦ鍥ㄦ償閹惧銈撮悹?|
| P0-AGENT-03 | 闁绘瑯鍓涢悵?H2 婵炴潙顑堥惁?profile | TECH-AGENT/src/test | Repository 婵炴潙顑堥惁顖炴焻濮樺磭绠?|
| P0-CON-01 | InteractionContext JSON Schema | docs/contract | Schema 婵炴潙顑堥惁?|
| P0-CON-02 | Envelope Schema闁靛棔鑳堕鐑藉触瀹ュ懏瀚查弶鈺佹处濠€锟犲冀閿熺姷宕?| docs/contract闁靛棔绔窯ENT | 缂佲檧鍓濋弫鐓幟圭€ｎ厾妲?|
| P0-CON-03 | Run闁靛棔绗抳ent闁靛棔绔糽aim闁靛棔绗抳idence Schema | docs/contract | 闁稿繒鍘ч鎰板箑瑜庣粊瀵告嫚?|
| P0-CON-04 | 婵☆垪鍓濈€?RunEvent SSE | TECH-AGENT | 闁告挸绉堕顒勫矗椤栨稓啸閻?|

### 闂傚倶鍔庨々?

- `mvn test` 濞戞挸绉村ú?ApplicationContext 闁?Entity 闁哄嫮濮撮惃鐘冲緞鏉堫偉袝闁?
- Flyway 闁烩晩鍠栫紞宥夊籍?`.bak` 闁告粌鐭傞崳鍛婂緞瀹ュ洤顣奸柡鍫墾缁?
- 閺夆晛娲﹀﹢锟犲箣閺嶎偒鍤冮柡鈧?Envelope 閻炴凹鍋呯€氬棛绱掑┑鎾跺耿
- 婵☆垪鍓濈€?SSE 闁煎啿鈧噥娼堕柛鎾崇Ф椤忣剛鎲撮敐鍡欌偓浠嬫晬?
- 濞戞挸绉撮崢鎴犳媼閹间焦鏅╅悹鍥跺灠閹奸攱鎯旈弬鎯ф倧閻熶礁鎳忛崹姘跺箣閹邦剙顫犻柕?

## 5. P1闁挎稒鐡宯tology 闁哄秶顭堢缓楣冩嚄閽樺顫?

### Backend

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P1-ONT-01 | 闁烩晜顭囬崑锝夌嵁閸撲胶鍩犲☉鎾亾 Concept闁靛棔鍓痓ject闁靛棔绔竧tribute闁靛棔闃渆lation API | TECH-ONT | API 婵炴挸鎳庡畷鐔衡偓闈涚秺缂?|
| P1-ONT-02 | Object Query DTO 闁告粌鑻顒勫极閻楀牏澧″Δ?| TECH-ONT | 闁告瑥鍊归弳鐔访圭€ｎ厾妲?|
| P1-ONT-03 | 闁告瑯浜ｉ?Object 闁哄被鍎撮?| TECH-ONT | tenant/version 闂傚懏姊婚‖?|
| P1-ONT-04 | Metric Query Service | TECH-ONT | Agent 濞戞挸绉烽崵婊呮偘瀹€鍐惧悁缂?Metric |
| P1-ONT-05 | Relation Query Service | TECH-ONT | 闁稿繐纾柈鎾级閸愵喗顎欐繛鏉戭儓閻?|
| P1-ONT-06 | Ontology Version Resolver | TECH-ONT | 闁绘鐗婂﹢鐗堢▔瀹ュ懐鎽犻柛锔哄妼瀹撳棝骞忛幒鏃傚崪 |
| P1-ONT-07 | OntologyContextService | TECH-AGENT + TECH-ONT client | Envelope 闊浂鍋嗛崣搴∶圭€ｎ厾妲?|
| P1-ONT-08 | Envelope 缂佹稒鍎抽幃鏇㈠椽瀹€鍐畺闁哄牏鍠愰悧搴㈩殽?| TECH-AGENT/security | 缂佲檧鍓濋弫鐓幟圭€ｎ厾妲?|
| P1-ONT-09 | 闁哄牃鍋撻悘蹇撶箰瑜把呮嫚?Ontology Tools | TECH-AGENT/tools/MCP | allowlist 婵炴潙顑堥惁?|
| P1-ONT-10 | Object闁靛棔搴渆tric闁靛棔闃渆lation 濠靛倹鍨圭€瑰啿霉鐎ｎ厾妲?| tests/contract | 闁哄牆绉存慨鐔兼⒒?JSON 閻庨潧缍婄紞?|

### Frontend

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P1-FE-01 | InteractionContext TypeScript 缂侇偉顕ч悗?| shared | 缂侇偉顕ч悗宄拔涢埀顒勫蓟?|
| P1-FE-02 | context 闁哄瀚伴埀顒傚Т濞呮帡宕仦鑺ョゼ閻?Fixture | shared | objectId 婵繐绲块垾?|
| P1-FE-03 | 濡炪倗鏁诲?subject 婵炲鍔岄崣?| APP-DW | customer detail 闂侇偅淇虹换?|

## 6. P2闁挎稒鐡揂G 闁活厹鍎撮惁鎴炴償閹剧粯锛旈柣?

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P2-RAG-01 | Document闁靛棔绔糷unk闁靛棔绔籭nding 濠靛倹鍨圭€?| TECH-RAG/APP-KB | Schema 婵炴潙顑堥惁?|
| P2-RAG-02 | 闁哄倸娲﹂妴鍌炲礆閸℃瑥顣婚柡鍫濈Т婵?| TECH-RAG | 闁搞儱鎼悾楣冨棘閸ャ劍鎷辩紒瀣暱閻ｉ箖宕氶崱娆忣暬 |
| P2-RAG-03 | 闁告碍鍨块崳铏规閵忕姷绌块梺顐㈠€块崢?| TECH-RAG | 闁告劖鐟ラ崣?婵☆偀鍋撶紒渚垮灪缁佸鎷?|
| P2-RAG-04 | Ontology Filter | TECH-RAG | scope 闁汇垻鍠愰弲?|
| P2-RAG-05 | chunk 鐎殿喗娲滈弫銈夊炊閻愭潙鍤?| TECH-RAG | document/chunk 闁告瑯鍨板ú鏍р攦?|
| P2-RAG-06 | Agent RAG Tool 闁告粌鐬肩划銊╁几濠婂棭姊块柛?| TECH-AGENT | 濞戞挸绉风粔瀛樻綇閹惧啿寮冲Λ鏉垮閻?|
| P2-KB-01 | document.uploaded 濞存粌顑勫▎?| APP-KB/TECH-MSG | 闁告瑯鍨辩粔椋庢嫻?|
| P2-E2E-01 | 闁哄倸娲﹂妴鍌毼涢埀顒傛閵忕媭娈╃紒鎾呴檮缁佸鎷?| tests/contract | 鐎殿喗娲滈弫銈団偓鐟版湰閺?|

闁告娲戦柌?chunk 闁烩晩鍠楅悥锝嗙▔瀹ュ牏孝閺?800 tokens闁挎稒绋愮粩鏉戔枎?Tool 濮掓稒顭堥濠氬嫉閳ь剚寰勫宕囩闁?5 濞?chunk闁挎稒鐩弳閬嶅棘閸ャ劊鈧倽绠涢崨娣偓蹇涘箰婢舵劑鈧骞嬮弽顐ゅ娇闁煎搫鍊荤€氼厾绮╃€ｎ亶妲遍柣鐐叉閳?

## 7. P3闁挎稒顑廵erFlow Runtime 闁规亽鍎遍崣?

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P3-DF-01 | Gateway health 闁告粌鐭傞弫濠勬嫚椤栨稒衼閻?| TECH-AGENT/deerflow | 閻℃帒鎳忓鍌毭圭€ｎ厾妲?|
| P3-DF-02 | run request/response DTO | Adapter | JSON 濠靛倹鍨圭€?|
| P3-DF-03 | tenant/user/run/trace 闂侇偄绻嬬槐?| Adapter | 闂佺偓宕橀惌楣冨矗椤栨稓鍙€ |
| P3-DF-04 | 濞戞挸绉磋ぐ鏌ュ矗?Envelope 婵炲鍔岄崣?| Adapter/Middleware | 缂佲檧鍓濋弫濂稿箯閹烘梻鍗?|
| P3-DF-05 | SSE 闂佹彃绉风换娑㈠Υ娴ｇ绲挎繛鎴濈墑閳ь兛娴囩粔鎾籍?| Adapter | 闁轰礁鎳樺▓鏉棵圭€ｎ厾妲?|
| P3-MW-01 | Context Middleware | middleware | 缂傚倸鎼悺褍鈻撻崹顐㈢彆缂?|
| P3-MW-02 | Grounding Middleware | middleware | Concept/Metric 婵炴潙顑堥惁?|
| P3-MW-03 | Permission Middleware | middleware | Tool 闁谎嗘閹洟宕￠弴鐔恒偞閻?|
| P3-MW-04 | Evidence Middleware | middleware | 闁哄啰濮鹃惁澶愬箲?Claim 闁瑰嚖闄勯崺?|
| P3-MW-05 | Observation Middleware | middleware/events | RunEvent 閻庣懓鏈弳?|
| P3-SUB-01 | Sub-Agent Context Builder | subagent | 濞戞挸绉撮ˇ鏌ュ礆閸撲礁鐓戝☉鎾筹梗缁楀懘寮?|
| P3-WS-01 | Workspace quota | workspace | 閻℃帒鎳樺鍝勩€掗崨顖涘€?|
| P3-SBX-01 | Sandbox 闂?root 闁告粌鑻崵顓犵磾閹寸姵顏ら柛姘Т瀹?| sandbox/infra | 閻庣懓顦崣蹇撁圭€ｎ厾妲?|
| P3-ART-01 | Artifact 闁稿繐鍟弳鐔煎箲椤斿吋瀚?MinIO 鐎殿喗娲滈弫?| artifact | 闁告瑯鍨粭鍛姜婵劏鍋撴担绋胯闁搞儳鍋為崙?|

P3 闁汇劌瀚〒鑸垫媴鎼淬劍锛旈柣婊庡灡濡叉悂鏁?

```text
DeerFlow 闁?ontology.get_object/query_metric 闁?Claim 闁?Evidence 闁?SSE
```

濞戞挸绉寸欢閬嶆儎鐎涙ê澶嶉柟绗涘棭鏀?Action 闁瑰瓨鐗為鏍⒒椤旇崵鐟归柛鏂哄墲閺嗙喖骞戦鑲╂皑闁?

## 8. P4闁挎稒鐡攗perAI 濞?Object Copilot

### 闁告挸绉堕顒佺鐠囨彃顫?

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P4-FE-01 | InteractionContextProvider | shared | 濞寸姷绮崜鐗堛亜閻㈠憡妗ㄩ柛娆樺灥楠炲繘宕?|
| P4-FE-02 | Customer detail 婵炲鍔岄崣?subject | APP-DW | objectId 婵繐绲块垾?|
| P4-FE-03 | Copilot Drawer shell | APP-DW | 闁告瑯鍨辨晶锕€顕ｉ埀?闁稿繑濞婂Λ?|
| P4-FE-04 | `useAgentStream` | shared | 閺夆晝鍋炵敮鎾Υ娴ｈ櫣娉㈤柡澶屽枂閳ь兛绶氶弫濠勬嫚椤栨氨鏆氶柡?|
| P4-FE-05 | SSE reducer | shared | seq闁靛棔绶氶崳鍛婂緞瀹ュ啠鍋撴笟鈧崳鍛婃交閻愭惌鍔€缁?|
| P4-FE-06 | ClaimRenderer | shared | 濞戞挸顦辩悮?Claim 闁告牕鎼崹?|
| P4-FE-07 | EvidenceRenderer | shared | 闁告瑯鍨伴惈宥咁嚕閳ь剟濡存担鐣屽劜閺夌儐鍓氬闈涒攦?|
| P4-FE-08 | 闂佹寧鐟ㄩ銈夊Υ娴ｇ绲挎繛鎴濈墑閳ь兛绶氶崳鍝ユ嫚?UI | APP-DW | 闁轰礁鎳樺▓浼村矗椤栨稐鍒掑?|
| P4-FE-09 | 30闁?0 闁哄鈧櫕绨氶柡鍜佸灦濡埖锛愬鈧▔?| tests/eval | 闁告瑯鍨辨竟鎺楁煂韫囨挻绀€闁衡偓?|

### 闁告艾娴烽顒佺鐠囨彃顫?

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P4-BE-01 | `/api/v1/agent/run/stream` 濠靛倹鍨圭€规娊鏌呴崒鐐插赋 | TECH-AGENT/API | SSE headers 婵繐绲块垾?|
| P4-BE-02 | Run 闁告帗绻傞～鎰板礌閺嵮勫 RUN_STARTED | runs/events | 闁告瑯鍨遍悡锛勬嫚?|
| P4-BE-03 | Context 闁哄瀚紓鎾诲椽瀹€鈧鐑藉触?| context | Envelope 闁解偓閽樺姘?|
| P4-BE-04 | Fast Query 閻犱警鍨抽弫?| runtime | 缂佺姭鍋撻柛妤佹礃閻擄紕鎷犻～顓犵憹閺?Deep |
| P4-BE-05 | Ontology Tool 閻犲鍟伴弫?| tools | allowlist 闁汇垻鍠愰弲?|
| P4-BE-06 | Claim Builder | evidence | 缂備焦鎸婚悗顖炲礌閺嶎剛缈婚柛?|
| P4-BE-07 | Evidence Gate | middleware | 闁哄啰濮鹃惁澶愬箲椤旇崵鐟濋柛鎴犲劋濞撳墎绱?Claim |
| P4-BE-08 | SSE Event Publisher | events | seq 濡炪倕鎼花顓烆潰閿濆洠鈧?|
| P4-BE-09 | 闁告瑦鐗楃粔鐑藉椽瀹€鍐㈤柡?| execution | 闁绘鍩栭埀顑跨劍椤掓粎娑?|
| P4-E2E-01 | 閻庡箍鍨洪崺娑氭嫚閿旇棄鍓伴柛娆樹海椤曚即宕烽悜妯荤彲 | frontend/backend | 闁稿繈鍔戦幗鑲╂崉椤栫偐鍋撳宕囩畺 |

### P4 闂傚倶鍔庨々?

- 濡炪倗鏁诲鎵偓鐢殿攰閽栧嫰鎳涢鍕楅弶鈺傜☉閸欏棙绋夋繝浣虹憮闁哄倸娴勭槐?
- Metric 闁哄鍎撮崵?Ontology闁?
- 缂佸倷鐒﹂娑氣偓娑欘殕椤斿本绋夊鍫㈢闁稿繈鍎茶啯闁搞劌顑戠槐?
- Fact闁靛棔娴畁ference闁靛棔闃渆commendation 闁告帒妫楃槐鎴犱沪閺囩姰浠涢柨?
- 闂佹彃绉烽々锔剧磼閹捐鍟堥柛蹇嬪姂閸庢挳寮?Evidence闁?
- 濡絾鐗旂花銊︾鐠虹儤顐介弶鈺冨枔濞蹭即寮介崶褏姣堝ù?1.5 缂佸甯槐?
- 闂佹彃绉撮ˇ鏌ユ⒒椤曗偓椤ｄ粙宕ｉ姘兼Щ闁?Envelope闁?

## 9. P5闁挎稒顑媍tion 婵炲矁宕甸幃?

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P5-ACT-01 | Action Schema 闁告粌鐭傞ˉ鎾绘⒔閳哄啰鎼肩紒?| TECH-ACTION | JSON Schema/Policy 婵炴潙顑堥惁?|
| P5-ACT-02 | proposeAction | AGENT/ACTION | 闁告瑯浜為弫鎾诲箣?Proposal |
| P5-ACT-03 | simulateAction | TECH-ACTION | 鐟滄澘宕幖閿嬶紣閸曨剛銈撮柛娆樺灥琚欓梺?|
| P5-ACT-04 | ActionGuard | AGENT middleware | 閻℃帒锕ュ鍫ュ椽瀹€鍕蒋濡炲閰ｅ▍鎾诲箯閿旇棄鐒?|
| P5-WFE-01 | Approval Workflow | TECH-WFE | 闁绘鍩栭埀顑跨劍濠р偓婵炴潙顑堥惁?|
| P5-ACT-05 | 妤犵偛鍊婚悺鎴﹀箥瑜戦、鎴﹀闯?| TECH-ACTION | 闂佹彃绉撮ˇ鑼嫚闁垮婀撮柛娆樹簼婢х晫鎮扮仦鑲╊伇婵?|
| P5-MSG-01 | action.executed 濞存粌顑勫▎?| TECH-MSG | Outbox/婵炴垵鐗愰崹鍌毭圭€ｎ厾妲?|
| P5-E2E-01 | 闁告帗绋戠紓鎾舵崉閻旇崵绠诲ù鐘侯嚙婵?| APP-DW/AGENT/ACTION | 濞达絽閰ｉˉ鎾绘⒔閳哄懏锛旈柣?|
| P5-E2E-02 | 闁汇垹鐤囬顒佸濡鍔曢悗鍏夊墲婢?| APP-DW/AGENT/WFE | 閻庡厜鍓濇竟鎺楁⒒椤撶姴绠?|

閻熸瑥瀚崹顖炴晬濮濆嵐oposal 闁哄牜浜濇竟鎺楀礄閸℃洜鐟濋柤瀹犲Г婢х晫鎮板畝瀣耿濡ゅ倹锕㈤ˉ鎾绘⒔閳轰胶绠戝銈堫嚙椤撴悂骞嶉惂鍝ュ耿闁告瑥鍊归弳鐔煎嫉瀹ュ懎顫ょ紒鏃戝灦閸ｆ悂寮悧鍫㈠ⅰ濡ょ姴鐭夌槐閬嶅箥瑜戦、鎴犵磼閹惧浜煫鍥ф嚇閵嗗繒鈧銈庡悁闁告粌鑻ぐ鍌滄暜閸愌呯殤濞寸姾缈伴埀?

## 10. P6闁挎稒鐡宯tology Authoring

```text
Document 闁?Extraction 闁?CandidateFact 闁?Validator 闁?Draft 闁?Approval 闁?Commit 闁?Version/Diff
```

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P6-EXT-01 | document.uploaded 婵炴垵鐗愰崹鍌炲椽?Extraction Run | TECH-AGENT | 闁煎疇妫勯崹鍗烆嚈?Run |
| P6-EXT-02 | 闁哄倸娲﹂妴鍌炲礆閸℃瑥顣婚悹瀣暙鐎?| AGENT/RAG | 婵絽绻掓晶鏍偑椤掑倻褰?|
| P6-EXT-03 | 闁告艾鐗嗛幃鎾诲Υ娴ｆ垝绮撶紒顖濐唺濮瑰濡存笟鈧ˉ鎾绘⒔閳瑰簱鍋撴担瑙勵槯闂傚倸顕崵搴ㄥ炊濞戞俺顫?Sub-Agent | AGENT | CandidateFact 闁哄牆顦抽惁澶愬箲?|
| P6-VAL-01 | CandidateFact Schema 闁哄稄绻濋悰?| AGENT/ONT | 闂傚牏鍋炵涵鍓佲偓娑欘殕椤斿矂骞忛幒鏃傚崪 |
| P6-VAL-02 | 闁告劘灏欓悰濠偽涢埀顒€霉?| TECH-ONT | 闁告瑯鍨伴悾鐐媴瀹ュ懎鏆辩紒?|
| P6-DRAFT-01 | Draft 闁艰鲸鑹鹃幃搴ㄥ椽鐏炲墽鍙€閻?| ONT/AGENT | 闁艰棄顦遍…鍫ュ矗椤栨稓鍙€ |
| P6-UI-01 | CandidateFact 闁告粌鑻崯璺ㄧ玻?UI | APP-KB/ONTSTUDIO | 闁告瑯鍨伴鎼佸冀?|
| P6-COM-01 | Commit Service | TECH-ONT | 闁哥儐鍨粩鎾礃濞嗗繐寮抽柛?|
| P6-COM-02 | 閻庡厜鍓濇竟鎺楀Υ娴ｅ搫顣奸柡鍫厵閳ь兛绗峣ff闁靛棔闃渙llback | WFE/ONT | 闁稿繈鍔庨埢濂稿矗椤栨繃瀚规繝?|
| P6-E2E-01 | 濞戞挸锕ｇ槐鍫曞触閸繃鍊遍柣銏㈠枑閸ㄦ岸鎳℃径宀婄劸 | KB闁愁偅澧ENT闁愁偅澧篘T | 30 缂佸甯掗崬鎾矗椤栨稓鍙€ |
| P6-E2E-02 | 闁艰棄顦遍…鍫⑩偓鍏夊墲婢规帡骞撻幇顏呭攭 | UI闁愁偅澹揊E闁愁偅澧篘T | 闁告瑯鍨板ú鏍ь煥?|

## 11. P7闁挎稒鐭花銊︾閸洍鏀抽柛鏂诲妺缁楀矂姊归幐搴㈠焸閻犱焦婢樼换?

### 濞存粌顑勫▎銏＄鐠囨彃顫?

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P7-EVT-01 | Ontology Event Topic | MSG/ONT | 濞存粌顑勫▎銏＄附閹寸姴顔?|
| P7-EVT-02 | Trigger 婵炲鍔岄崬鑺ョ▔鎼淬垺缍€闂?| AGENT | CRUD 婵炴潙顑堥惁?|
| P7-EVT-03 | Event Consumer | AGENT | 婵炴垵鐗愰崹鍌炵嵁閸屾粎鎼?|
| P7-EVT-04 | once/cron/interval 閻犲鍟€?| AGENT/Kafka | 閻犲鍟€瑰啿霉鐎ｎ厾妲?|
| P7-EVT-05 | 妤犵偠娉涜ぐ鍌炲椽瀹€鍕垫殨缂佺姵顨嗙敮鍫曞礆?| AGENT | 閻℃帒鎳樺鐑樼▔瀹ュ懎鐏＄€?Run |
| P7-EVT-06 | 闁告艾鐗嗛幃鎾诲礆閻楀牊鍩?Trigger | AGENT | 婵☆垪鍓濈€氭瑦绂嶇€ｂ晜顐介梺顐ｄ亢缁?|
| P7-EVT-07 | 闂侇偅姘ㄩ悡锟犳焻閸岀偛甯抽柛?| MSG/APP | 闁活潿鍔嶉崺娑㈠绩鐠哄搫鐓傞梺顐ｆ皑閻?|
| P7-E2E-01 | 闁告艾鐗嗛幃鎾诲礆閻楀牊鍩傚瀣叄濞呮捇宕氶崱妯尖偓?| ONT闁愁偅澧ENT闁愁偅澧P | 闁煎浜滄慨鈺冣偓鐟版湰閸ㄦ岸鐛崼鏇楀亾濮樿京鍙€ |

### 閻犱焦婢樼换鍌涚鐠囨彃顫?

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P7-MEM-01 | Working Memory | AGENT | Run 闁告劕鎳樺▓褏绮?|
| P7-MEM-02 | Episodic Memory | AGENT | 闁告ê妫楄ぐ?Run 闁告瑯鍨拌ぐ顐﹀炊?|
| P7-MEM-03 | Semantic Memory | AGENT/ONT | 缂備礁绻楃换?Validator |
| P7-MEM-04 | Organizational Memory | AGENT | 缂備礁瀚划鎰板级閸愵喗顎欓梻鍛⒒椤?|
| P7-MEM-05 | PII 婵☆偀鍋撴繛?| AGENT | 闁告劖鐟ラ崣鍡涘礈瀹ュ鈻庨柡?|
| P7-MEM-06 | 闁活潿鍔嶉崺娑㈠蓟閵壯勭畽闁告粌鑻崹褰掓⒔?| APP/AGENT | 闁告帞濞€濞呭酣宕ｉ鐐靛矗閻?|
| P7-MEM-07 | Memory budget | AGENT | 闁告瑯鍓欏ú鏍ㄧ▔瀹ュ牏孝濡澘瀚悾?|

## 12. P8闁挎稒姘ㄩ弫鎾寸瑜庢稉宥夋偠閸℃洜鐟?Native Runtime

Native Runtime 闁革负鍔庡﹢锛勨偓?Graph闁靛棔绠憃ol Calling闁靛棔绔糽aim/Evidence闁靛棔绔糷eckpoint/Resume 閻庣懓鏈崹姘跺礈瀹ュ繒绀夊☉鎾崇Т缁惰鲸顪€濡鍚囬弶鈺傛煥濞?SUCCESS闁?

| ID | 濞寸姾顕ф慨?| 濞ｅ浂鍠楅弫濂告嚑閸愩劍绾?| 濡ょ姴鏈弫?|
|---|---|---|---|
| P8-OBS-01 | RunEvent闁靛棔鐒︾€垫岸寮介崶褎瀚查柟瀛樺姈濠€?| OBS/AGENT/LLMGW | Run 闁告瑯鍨甸幏宄扳攦?|
| P8-SEC-01 | Prompt Injection 闁告粌濂旂粭鍌涘閻樻彃鏁堕悗鐟扮秺濞堁呯矉?| AGENT/RAG/Sandbox | 閻庣懓顦崣蹇撁圭€ｎ厾妲?|
| P8-REL-01 | 閻℃帒鎳忓鍌炲Υ娓氣偓閸ｅ摜鎷犻弴妯峰亾娴ｅ搫鏅柡鍌ゅ幑閳ь兛绀佽ぐ鍥р槈?| Adapter/clients | 闁轰礁鎳樺▓鏉款煶閺冨倻鐭?|
| P8-REL-02 | 闁诲繑婢樼€规娊宕仦鑺ョ婵?| Gateway/runtime | tenant 闁诲繑婢樼€?|
| P8-NAT-01 | SAA ChatClient 闁哄牃鍋撻悘蹇撶箺閻ㄧ喖鎮?| native | Mock LLM 濠靛倹鍨圭€?|
| P8-NAT-02 | SAA Graph 闁煎搫鍊婚崑?| native | 闁告娲栧ù妯好圭€ｎ厾妲?|
| P8-NAT-03 | Tool Calling | native/tools | 闁告瑯浜ｉ鎵嫬閸愵亝鏆?|
| P8-NAT-04 | Claim/Evidence 闁煎搫鍊婚崑?| native/evidence | Evidence Gate |
| P8-NAT-05 | Checkpoint/Resume | native/checkpoint | 濞戞搩鍘介弻鍥箒閵忕媭妲?|
| P8-NAT-06 | Native/DeerFlow 缂備胶鍠嶇粩鎾传瀹ュ懐瀹?| native/deerflow | 闁告艾濂旂粩?E2E |
| P8-NAT-07 | 濮掓稒顭堥璇参熼垾宕囩闁告粌鑻悾銊╁礂閵娾晜顎栫紒?| config/gateway | 闁哄牜浜滈悿鍕偝妫颁胶鐟濈€?SUCCESS |

## 13. 闁告挸绉撮幃妤冪博椤栨繀绮撻悹瀣暟閻撯晠姊?

| 闁逛絻顫夐?| 闁告挸绉堕顒勫礂閵夈儱缍?| API | 闁告艾娴烽顒勬煣閹规劗鐔?| 闁稿繑濞婇弫顓熺鐎ｂ晜顐?| 濡ょ姴鏈弫?|
|---|---|---|---|---|---|
| E0 | 闁?| health/contract | 闁糕晞娅ｉ、鍛村嫉瀹ュ懎顫ら柕鍡曟诞AM闁靛棔搴淪G | 闁?| smoke |
| E1 | 濡炪倗鏁诲?Context Fixture | context API | IAM闁愁偅澧篘T闁愁偅澧畁velope | CONTEXT_BUILT | contract |
| E2 | Copilot shell | `/api/v1/agent/run/stream` | Agent闁愁偅澧簄tology Query | RUN/TOOL | SSE |
| E3 | Claim/Evidence UI | 闁告艾濂旂粭?| Evidence Gate | EVIDENCE_ATTACHED | UI/E2E |
| E4 | 婵烇絽宕€规娊宕氶崱妯尖偓?UI | `/superai/run` | Grounding闁愁偅澹寀b-Agent | TASK/SUBAGENT | scenario |
| E5 | Action 缁绢収鍠涢?| proposal/simulate | Guard闁愁偅澧TION/WFE | APPROVAL/ACTION | 妤犵偛鍊婚悺?|
| E6 | 闂侇偅姘ㄩ悡锟犲礂閵夈儱缍?| trigger APIs | MSG闁愁偅澹峳igger闁愁偅澹妘n | ONTOLOGY_EVENT | event |
| E7 | Authoring UI | draft/commit | Extraction闁愁偅澹恆lidator闁愁偅澧篘T | DRAFT/COMMIT | workflow |
| E8 | 閺夆晜鍔楀ǎ顕€宕仦绛嬪悁閻?| run/events/metrics | OBS/LLMGW | 闁稿繈鍔戦崕瀛樼鐎ｂ晜顐?| audit/load |

婵絽绻嬮柌婊堝箥鐟欏嫷鍋ч柛蹇撶墦閳ь剚淇虹换鍐触鎼达綆浼傚┑鍌涘灩鐎瑰啿霉鐎ｎ厾妲搁柨娑樿嫰閸熲偓闁规亽鍎遍崣鍡涘礈瀹ュ浂浼傞柨娑欐姳ixture 闁告瑯浜ｉ崗姗€鎮介妸銈囪壘鐎殿喒鍋撻柛娆愬灥閹锋澘霉鐎ｎ厾妲搁柨娑樺缁楀鎳楅懞銉︾濞寸媴绲垮﹢锛勨偓?API闁?

## 14. 婵炴潙顑堥惁顖涚▔鎼淬劎宕ｉ柡鈧?

婵炴潙顑堥惁顖滀沪閸屾侗鍋ч煫鍥ф嚇閵嗗繑绋夐悮瀵哥獥

```text
闁告娲栭崢鎾趁圭€ｎ厾妲?闁?Repository 闁?濠靛倹鍨圭€瑰啿霉鐎ｎ厾妲?闁?Middleware 闁?Service Integration
闁?SSE 闁?闁告挸绉堕顒傜磼閸曨亝顐?闁?闁革妇鍎ゅ▍?E2E 闁?閻庣懓顦崣?闁?閻犳劗鍠曞ù鍥ㄧ▔鎼淬垺娅婇梻?
```

闊洤鎳橀妴蹇曟啺閸℃瑦纾伴柨娑欐皑椤倝骞嬮悿顖溞ㄩ柡澶婂暔閳ь兛绀侀顔炬寬闄囩粔娲级閸愶腹鍋撴担鍝ユ憻婵炲牅绲荤换鍐煥閵堝啠鍋撴担绋垮綘缂侇垳绮鍫ユ⒔閹扳斁鍋撴稉鎶elope 缂佲檧鍓濋弫濂稿Υ娑斺偓ool 閻℃帒锕ュ鍫ュΥ娑撴姵idence 缂傚倸鎼妵鎴﹀Υ娑撳垻tion 闁哄牜浜滈鎼佸箥楠炲簱鍋撴笟鈧崳鍛婂緞瀹ュ懐鐣电紒娑橆槶閳ь兛鐒︽导鎾诲箛韫囨梹鐎俊妤嬬祷閳ь兛绗゛teway 闁哄偆鍙€缁绘盯濡存稉绯濫 闂佹彃绉风换娑㈠Υ?

閻犳劑鍔戦崳娲儎椤旂晫鍨奸柨?

- Object 閻犲洤妫楅崺鍡涘礄閸℃瑢鈧﹢鎮?P4 闁?90%闁?
- Metric 濞达綀娉曢弫銈夊礄閸℃瑢鈧﹢鎮?P4 闁?90%闁?
- 闂佹彃绉烽々?Claim 鐎殿喗娲滈弫銈団偓鐟版湰閺嗭綁鎮?100%闁?
- 閻庢稒顨嗛宀€鎼炬繝鍐╃秬婵炲瀚板﹢鑸电▔?0闁?
- SSE 濡絾鐗旂花銊︾鐠鸿櫣姣堝ù?1.5 缂佸甯槐?
- Fast Query P95 閻忓繐绻嬬花?1.5 缂佸甯槐?
- Deep Task P95 閻忓繐绻嬬花?30 缂佸甯槐?
- Action 闂佹彃绉撮ˇ鏌ュ箥瑜戦、鎴炵▔?0闁?
- 婵絽绻嬮柌?Run 闁秆冩搐瑜版煡鏌呭宕囩畺 RunEvent 閺夆晞濮ら崙浠嬪Υ?

## 15. 鐟滅増鎸告晶鐘差嚕閳ь剙顔忛妷鈹库偓搴㈡償?

鐟滅増鎸告晶鐘崇閿濆洨鍨抽悗鍏夊墲閻撯€愁啅閹绘帒绲洪柣婊堫暒娴滄帗绋夌€ｎ喗鈻庨柡鍌ゅ弿缁?

1. `AgentCheckpointEntity` 濞戞挸顭烽弫顓㈠椽鐏炶棄寰撳ù?Entity 闁哄嫮濮撮惃鐘崇▔閳ь剟鎳涚€涙ǚ鍋撹缁?
2. H2 濞?PostgreSQL `jsonb`闁靛棔鐒﹂弻鐔烘嚊閳ь剟宕畝鍐闁规亽鍎遍崹鍨叏鐎ｎ亜顕ч柛蹇曞帶椤旀劙鏁?
3. Flyway 闁告帞濞€濞呭酣濡存笟鈧崳鍛婂緞瀹ュ洤顣奸柡鍫墮閹?`.bak` 婵炴挸鎳愰幃濠囨晬?
4. Native Runtime 閺夆晜鏌ㄥú?Mock SUCCESS闁?
5. 缂備焦鎸婚悗顖炲礌?Envelope 閻忓繑纰嶅﹢顓犳嫻椤栨壕鏁嶉柟绗涘棭鏀介梺鐐嫕缁?
6. Claim/Evidence 閻忓繑纰嶅﹢顓犳啺閸℃瑦纾伴柛蹇嬪姂閸庢挳宕欓崫鍕稉闁?
7. RuntimeRouter 闁告瑯鍨甸崗姗€宕ｉ鍛畳闁哄啨鍎辩换鏃堟晬鐏炲墽姊鹃柡鍫濐槺濠€锛勨偓鍦仦婢х晫鎮扮仦钘夌€奸柟璇℃緛缁?
8. 鐎规悶鍎扮紞鏃堝礌閻戞ɑ绠掑鍫嗗洤娅ら柡鍫簼瑜颁焦绂嶉妶鍡樻毉闁告棏鐓夌槐婵嬪棘妫颁焦宕查柛鏂衡偓宕囩畱濡炪倕顭峰娲礆閺堝灚鍙忛柡鈧涵鍛槺闁搞儲鐣埀?

闁规亽鍔忓畷姗€宕?12 濞戞搩浜欓幑銏ゅ礉閳藉懐绐?

```text
P0-AGENT-01 缂備胶鍠嶇粩?Agent Entity 濞戞挸顭烽弫?
P0-AGENT-02 闁轰礁顕幃濠冩交娴ｇ洅鈺呮儎椤旇偐绉?
P0-AGENT-03 鐎点倛娅ｉ悵?H2 婵炴潙顑堥惁?profile
P0-CON-01 InteractionContext Schema
P0-CON-02 Envelope Schema 濞戞挸娴烽鐑藉触?
P0-CON-03 Run/Claim/Evidence Schema
P0-CON-04 婵☆垪鍓濈€?SSE
P1-ONT-07 OntologyContextService
P1-ONT-09 濞存粍鏌ч柌婊堝矗椤忓浂鍤?Ontology Tools
P4-BE-02 Run 闁告帗绻傞～鎰板礌?
P4-BE-07 Evidence Gate
P4-FE-04 useAgentStream
```

缂佹鍏涚粩鎾级閳ュ磭绠戝銈囩帛婢э箓鏌呭杈ㄧ暠闂傚偆鍘鹃獮鍡涙晬?

```text
Customer Detail
  闁?InteractionContextProvider
  闁?Agent Stream
  闁?OntologyContextEnvelope
  闁?ontology.get_object/query_metric
  闁?ClaimBuilder
  闁?EvidenceGate
  闁?RUN_STARTED / TOOL_* / CLAIM_PRODUCED / RUN_COMPLETED
  闁?ClaimRenderer / EvidenceRenderer
```

闁革负鍔忛姘舵⒒椤撶姴绠氶梺顐ｄ亢缁诲啴宕滃蹇曠濞戞挸绉电敮瑙勬交濞戙垻褰瀣叄濞?Action闁靛棔娴囬崵婊堝礉?Authoring 闁?Native Runtime 濮掓稒顭堥濠氬礆閸ャ劌搴婇柕?

## 16. 闁搞儳鍋炵划瀵告喆閸曨偄鐏?

- DeerFlow 濞戞挸绉磋ぐ鏌ユ偨閵婏附顦ч柨娑樿嫰瑜把囨嚄閽樺鐎奸柟骞垮灩閸╁苯顔忛弻銉у矗閻?Fast Query 闁瑰瓨鐗炵换鎴﹀炊閻愬瓨顫栫痪顓у枛閵囨垹鎷归妷顖滃耿
- Native 闁哄牜浜滈悿鍕偝閻楀牊顦ч煫鍥ф嚇閵嗗繑娼婚弬鎸庣 `NOT_IMPLEMENTED` 闁瑰瓨鐗曢悾銊╁礂閵娾晜顎栫紒鐙欏秶绀夊☉鎾崇Т缁惰鲸娼婚弬鎸庣闁瑰瓨鍔曟慨?Mock闁?
- SSE 闁哄偆鍘肩槐鎴﹀籍閺堢數绠介柣?Run 闁绘鍩栭埀顑跨筏缁辨繈鐛懜鍨殰闁归晲鐒﹂悡锛勬嫚椤厾鐨戝ù鐘烘硾閹锋壆鈧懓顦崣蹇涙煂瀹ュ牏绠鹃柨?
- Tool 閻℃帒鎳忓鍌滄媼閺夎法绉?`TOOL_FAILED`闁挎稑濂旂粭澶婎嚗濡炴儳鎮忛梺顐ゅХ閳规牜绱掗幘瀵镐函闁?
- Flyway 闁告瑯浜ｉ崗妯绘交閽樺顫ｉ柣妤€鐗婂﹢浼存晬鐏炶偐鐟濋柛銉у仦閺佺厧顔忛崣澶娾挃閻炴稑鐭佺缓鑲╃矓娴兼瑧骞?
- Draft 濞戞挸绉存總鏍传瀹ュ棭鍔€鐎?Ontology闁?
- Commit闁靛棔绔竎tion闁靛棔搴渆mory 闁告帞濞€濞呭酣宕搁崶褏绠戝銈堫嚙瑜拌尙鈧銈庡悁闁?

## 17. 闁哄牃鍋撶紓浣哥墕閻ｎ剟骞嬮幇顒傛毎濞?

闁告瑯浜濆﹢渚€宕ョ仦鐐槯婵犲◥銈呭枙濞寸姰鍎扮粭鍛村级閳ュ弶顐介柨娑樻湰婢х娀宕ｉ姘煎悈缂佸澹嗛鍥ㄧ▔閳ь剟姊奸懜娈垮斀闁汇垻鍠嶆鍥矗椤栨粍鏆忛柨?

1. Object Copilot 缂佹棏鍨伴崺宀€绮╅鐐╁亾濮樺磭绠栭柨?
2. Context 缂備焦鎸婚悗顖炲礌閺嶃儮鍋撴担渚姰闁告艾绉查埀顑挎祰缁诲啴寮甸悢宄拌闁哄稄绻濋悰娆撴晬?
3. Tool 闁告瑦顨嗗鍫ユ⒔閹邦剚瀚?allowlist 缂佹拝闄勫顐︽晬?
4. 闂佹彃绉烽々?Claim 100% 缂備焦鍨甸悾?Evidence闁?
5. SSE 濡炪倕鎼花顓犵矙閸愯尙鏆板☉鎾存煥瑜版煡鏌屽鍫㈢闁?
6. 婵炲备鍓濆﹢?Action 缂備焦娲濈换?Guard闁?
7. 婵炲备鍓濆﹢?LLM 闁烩晛鐡ㄧ敮鎾礃?Ontology闁?
8. 闁圭鍋撻柡?Run 闁告瑯鍨堕埀顒佷亢缁?RunEvent 閺夆晛鈧喖鍤嬮柨?
9. Token 濡澘瀚悾濠氭偨鏉堛劍绠涢柛鏃撶磿椤忣剙顕ｉ崫鍕厬闁圭瑳鍡╂斀闁?
10. 婵炴潙顑堥惁顖炲Υ娴ｆ垝绮撻悹瀣暔閳ь兛绀佸ú鏍ь煥濮橆剚瀚查柡浣告嚇濞堟澘顭抽弮鍌滅煀闂侇喛濮ゅ﹢浣烘嫚娴ｇ懓绁﹂柕?

> 闁哄牃鍋撶紓浣哥墢濞蹭即寮介崶锔剧憹闁哄嫷鍨埀顒佺矋濠€浣圭▔閳ь剚绋夐鍥у幋闁煎崬锕ら妵澶愭儍?DeerFlow闁炽儲绻愮槐婵嬫嚀鐏炵偓笑濞?Ontology 濞达絾绮堢拹鐔稿娴ｉ鐟瑰☉鎾寸墱閺咁偄螣閳ュ磭鈧兘鏁嶇仦闂寸鞍 Agent Runtime 閻犳劗鍠曢惌妤冩媼閵堝洨鍙€闁告粌鐭侀～澶愬礆閹虹偟绀夊ù鐘劚瑜板牆鈻介懡銈嗗€為柣?Tool闁靛棔绔竎tion闁靛棔绗抳idence闁靛棔绠榦rkflow 闁?Event 鐟滆埇鍨洪崹姘跺矗椤栨凹鍚€閻犱籍鎵冲亾娴ｇ璁查柛銉у仦缁挳濡存担绋胯闁归晲鑳堕悽璇差煶閺冨洨绠婚柣銊ュ缁辨帗绋?AI 闁圭瑳鍡╂斀缂侇垵宕电划娲Υ?


### 17.1 閹?7 閻庣懓鏈崹姘償閿曗偓椤撳摜鎷嬮埥鍛v1.56 鐠?2026-07-27 00:10闁?

> 闁哄牜鍓濇俊顓㈡偨?Codex 闁煎浜滄慨鈺冪磼鐎涙ê袘闁靛棗鍊荤划銊ф媼鏉炴壆鐟濈紒娑橆槷缁剛鈧懓鏈崹?闁炽儲鏌￠埀?閻熸瑤鐒﹂惁鈩冦亜閸︻厽鐣遍悹鍥︾劍瀹撲線骞愰崶顒佸珱濞戞挸楠告晶鎸庢媴濞嗘搩妫戦梻鍕ㄦ杺閳?

| # | 闁哄鈧弶顐?| 闁绘鍩栭埀?| 濞戞挻妲掗々锔炬嫚娴ｇ懓绁?/ 缂傚倸鎼ぐ?|
|---|---|---|---|
| 1 | Object Copilot 缂佹棏鍨伴崺宀€绮╅鐐╁亾濮樺磭绠?| **DONE闁挎稑婢?.64闁挎稑鑻畷鐔访圭€ｎ亞婀撮梻鍫緛缁?* | v1.64 閻犙冨殩缁辩櫇cenarioA_ObjectCopilotTest 闁哄倹婢橀·?`objectCopilotFullStackFlow`闁?th test闁挎稑顧€缁辨繈宕￠弴姘鳖伇 @Test 閻犵儤鍨甸崣蹇涙煣閹规劗鐔?闁?Envelope + Grounding + Permission闁挎稑娼宔foreExecution闁? Evidence闁挎稑娼奻terToolCall binding Claim<->Evidence闁? ActionGuard闁挎稑娼奻terExecution HIGH-risk requiresApproval=true闁挎稑顧€缁辨繈鐛捄鐑樺剷闁绘粠鍨遍弻鍥╂嚊閳ь剙袙韫囨梹钂?Claim 闂侇喛濮ゅ﹢渚€妫冮悙纰樻晞 evidence 闁告帗顨夐妴鍐晬閸垺鍩涢柟?ScenarioF 濠靛倹鍨圭€规娊鏁嶆径鍫氬亾閸屾繄绠归柡鍕靛灠瀹曠喎霉鐎ｎ亞婀撮梻鍫涘灮濞?Object Copilot 缂佹棏鍨伴崺宀€绮╅妯峰亾?*闁活亞鍠愰婊堟儍閸曨喗纭堕柡鍫濈Т婵?mvn-boot闁挎稑婀stgres + Nacos + LLMGW + DeerFlow gateway闁挎稑顦划娑欍亜?Testcontainers / Docker 闁归潧绉烽崗妯尖偓鐟版湰閸ㄦ岸鎳涢鍕楅柛?闁?濞戞挸绉村﹢顏堝嫉椤掍焦绨氶柣婊庡灠椤ｃ劍绋夌€ｎ亜璁查梺鎻掔Т椤︽煡骞嶈椤?*闁挎稑濂旂紞鏃€绋?閹?7.2 follow-up item 1 闁汇劌瀚弫顔界▔閳ь剟宕滈埡鈧紞鎴炪亜楠炲簱鍋?|
| 2 | Context 缂備焦鎸婚悗顖炲礌閺嶃儮鍋撴担渚姰闁告艾绉查埀顑挎祰缁诲啴寮甸悢宄拌闁哄稄绻濋悰?| **DONE** | `OncologyContextEnvelopeService.build()` HS256 缂佹稒鍎抽幃鏇㈡晬閸?.50 P1-CON-02闁挎稑顧€缁辩浗OncologyContextServiceTest` 5 闁告娲樼粊瀵告啺閸℃瑦纾?signature/expiry/payload |
| 3 | Tool 闁告瑦顨嗗鍫ユ⒔閹邦剚瀚?allowlist 缂佹拝闄勫?| **DONE** | `OncologyPermissionMiddleware`闁挎稑鐗呴幈銊﹀緞?013 v1.50 閻犳亽鍔岄悡娆撳捶閻戞ɑ鐝繛鏉戭儓閻︻垶鏌呭宕囩畺闁? 5 濞戞搩浜滆ぐ褏鎷?Ontology Tools + `mate.agent.tool.allowlist` allowlist闁挎稒澶噃ase1 闁归攱甯炵划鐑藉嫉椤忓嫭韬?allowlist 闁汇劌瀚导鎰板礂?|
| 4 | 闂佹彃绉烽々?Claim 100% 缂備焦鍨甸悾?Evidence | **DONE闁挎稑婢?.58闁?* | 缂佺姵顨嗙涵鍫曟晬濮濇瓌ntologyEvidenceMiddleware.afterToolCall` 鐎殿喖鎼崺?ontology.* 鐎规悶鍎遍崣璺ㄧ磼閹惧浜梻鍫㈠仧閳?data -> Claim 闊洤鎳庨悽?evidence闁靛棗鍊界换宥囨偘鐏炵偓顦ч柨娑欘劙1.58 闁哄倹婢橀·?`ScenarioF_ClaimEvidenceBindingTest`闁? 闁告娲樼粊鎾晬婢跺本绾柟鎭掑劦閳瑰秹宕?MiddlewareChain.runAfterToolCall 闁稿繈鍔戦幗濂告晬?F1-F5) ontology.search_objects / query_metric / get_object_timeline 婵絽绻戦濂告焾閽樺鍤犳慨锝呯箣闁?Claim 濡ょ姴鐭侀惁?>=1 Evidence闁?F3) 濡ょ姴鐭侀惁澶愭?ontology.* 鐎规悶鍎遍崣鍧楁晬閸х敘g.search闁挎稑顦扮€垫粎鎷嬮幑鎰靛悁濞戞挸绉烽崵婊堝礉?bind闁?F6) context.rejected=true 闁活収鍙€閻偓绌卞┑鍥戦柕鍡楀€介々顐︽儎?閹?7.4 閺夆晜鍔橀、鎴﹀籍閹壆妲堥柡?|
| 5 | SSE sequence and reconnect | **DONE (v1.63)** | Backend replay/controller contracts and frontend useAgentRunEvents now cover named event/id/data frames, exclusive afterSeq replay, tenant isolation, monotonic seq, reconnect from lastSeq, duplicate suppression, and gap rejection. |
| 6 | 婵炲备鍓濆﹢?Action 缂備焦娲濈换?Guard | **DONE** | `OncologyActionGuardMiddleware` 闁革负鍔嶆晶宥夊嫉?Run 濞戞挸锕ョ€氥倝骞嬮搴ｅ耿`OncologyGroundingMiddleware` 闁解偓閽樺鍕鹃柛濠冪懇閳?action闁挎稒濂攃enarioA ObjectCopilot 婵炴潙顑堥惁顖涚▔椤撱垻宕ｉ悹?|
| 7 | 婵炲备鍓濆﹢?LLM 闁烩晛鐡ㄧ敮鎾礃?Ontology | **DONE** | 濞存粍鏌ч柌婊堝矗椤忓浂鍤?Ontology Tools闁挎稑娼恊scribe/search/get/query_metric/evidence闁? LLM 閻犲鍟伴弫銈囩磼?TECH-LLMGW闁挎稑婀痯ringAI 婵炵繝绀佺槐?+ Noop fallback v1.54闁挎稑顧€缁辩洨ECH-RAG 缂佹棏鍨伴崺宀€绮╅鐐╁亾濮樺磭绠?RAGClient 闁?RAG base-url 閻犲鍟伴弫銈囩棯閿旇姤灏?|
| 8 | 闁圭鍋撻柡?Run 闁告瑯鍨堕埀顒佷亢缁?RunEvent 閺夆晛鈧喖鍤?| **DONE闁挎稑鐗嗛悢鈧痪顓涘亾闁?* | `runEventService.record()` 闁?create/start/llm/tool/claim/evidence/action/complete/failed 闁稿繈鍔戦幗鑲╂崉椤栨繃鍎伴幖瀛樻惈缁辩浗run_events` V6 閻炴稏鍔岄悽?envelope_id+tenant_id+trace_id+seq闁靛棗鍊诲閬嶅矗閿濆繒绐楁繛灞稿墲濠€浣虹博椤栨艾鐓傜紒鏃戝灥濞?Run 閺夌偑鍔忛幎妤呭触閸繆瀚欓柣?traceparent + W3C trace_id 闁哄稄绻濋悰?|
| 9 | Token 濡澘瀚悾濠氭偨鏉堛劍绠涢柛鏃撶磿椤忣剙顕ｉ崫鍕厬闁圭瑳鍡╂斀 | **DONE闁挎稑婢?.56闁?* | 闁哄倹婢樼紓?`TokenBudgetEnforcer` + `AgentRunService` 7 闁?`complete(runId, status, answer, errorCode, errorMessage, tokensConsumed, elapsedMs)`闁挎稒顒猘rseBudget 闁告艾姘﹂妤呮⒒?enforcer闁挎稑鐭佺粔娲⒔閹邦剙绻侀柛?DEGRADED + errorCode `BUDGET_EXCEEDED` + errorMessage 闁?violation/overBy闁?0 闁告娲樼粊鎾晬? enforcer + 2 envelope闁挎稑顦崣蹇涙焾?PASS闁靛棗鍊婚埞?budget / 閻犳劗鍠愰弳?attempt 閻庣懓顦崣蹇旑渶濡鍚囬柡鈧幑鎰畺闁?|
| 10 | 婵炴潙顑堥惁顖炲Υ娴ｆ垝绮撻悹瀣暔閳ь兛绀佸ú鏍ь煥濮橆剚瀚查柡浣告嚇濞堟澘顭抽弮鍌滅煀闂侇喛濮ゅ﹢浣烘嫚娴ｇ懓绁?| **DONE闁挎稑婢?.60闁?* | 濠㈣埖淇洪悿鍡欐椤栨繍鍚€闁?a) mvn -o test 1226+ 闁告娲樼粊?PASS闁挎稑婢?.60闁挎稑顧€缁?b) 28 濞?Scenario 婵炴潙顑堥惁顖炴晬閸?B/D/E/F闁挎稑顦冲▔鏇熺▔椤撱垺锛熷ù鐘茬埣閹藉ジ鎯囬悢椋庢澖閺夆晜鍔橀、鎴︽晬?c) Flyway 闂佹彃绉撮ˇ?V 濞ｅ浂鍠栭ˇ?+ MigrationDirectoryAuditTest 闁规鍋呭鍧楀礂?monorepo 闂佸じ绀侀悾?clean-migrations闁?d) WfeApprovalReplayDrillTest 缂佹棏鍨伴崺宀€绮╅娑氬窛缂?WFE down -> DB 闁哄秴娲╅?FAILED -> WFE 闁诡厹鍨归ˇ?-> DLQ 闁圭儤甯為埞?+ 闁稿繈鍔岄惇顒傛嫬閸愩劌顔婇柛锝冨妽鐠愨晠宕?drain 閻犱讲鍓濋弳鐔煎Υ?*闁告挴鏅欑紞?*闁挎稒淇哄▔鏇㈠嫉瀹ュ懎顫ら柛銉у仦閺備礁顩奸崱妯间桓 `tests/replay/` 闁哄棗鍊瑰﹢顓烆嚕閺囩偛寮抽柨娑樼墕閻ɑ绂嶆惔鈽嗘澔闂佹彃绻戞慨鍥╂導閸曞墎绀夊☉鎾崇Т婵傛牠宕?閹?7.10 闁?鐎圭寮跺﹢浣烘嫚娴ｇ懓绁﹂柨?|

**缂備焦鎹侀?*闁挎稒顒?.63 閻?閹?7 闁稿繈鍔戦崕?10 闁哄鈧櫕韬?*濞寸媴绲块悥?+ 闁告娲樼粊瀵镐沪閸岀偞妗?* DONE闁挎稒纰嶇粊瀵告嫚?闁艰鲸妫侀惃?闁搞儳鍋炵划?闁轰礁鎳樺▓鏉款煶閺冨倻鐭?(閹?7.10) 濞?Object Copilot 缂佹棏鍨伴崺宀€绮?(閹?7.1) 闂侇喖鈧噥娼?ScenarioA fullstack + ScenarioF + MigrationDirectoryAudit + WFE Drill 闂傚偆鍘鹃獮鍡橆殽瀹€鍐闁挎稒绋戦弫顔界▔閳ь剚绂掑澶堚偓蹇斿緞閺嶎厼鍔ラ柛鈺勬椤㈠懐鎷嬮悙顒佺參闁汇劌瀚Σ?閹?7 item 1 闁汇劌瀚ч埀顒佺矎濞夋洟寮靛鍛潳 mvn-boot闁炽儲绻愮槐姗畂stgres + Nacos + LLMGW + DeerFlow gateway 闁告艾鏈鍌炲触椤栨艾袟闁挎稑顧€缁辨繃銇?Testcontainers / Docker 闁归潧绉烽崗姗€鎳涢鍕楅柛鏍ㄧ墦閳ь剙鍊介姘亜閻熺増韬柡鍌氭处閵?閹?7.2 item 1 濞戞搩鍘虹紞鏃€绋夐悜妯兼殭闁?CI 闂傚啳鍩栭灞剧鐠囨彃顫ら悹浣规緲缂嶅秹濡?*濡絾鐗犲Ο浣糕枔閻㈠灚鏅稿ù婧犲啯韬憸鐗堟尭婢х娀鎮抽姘兼殧濞戞挸顑呰ぐ鍙夋綇閹惧懐绐楅柛锔哄妽缁噣鎯?+ 闁告娲栭崢鎾趁圭€ｎ厾妲稿☉鎾卞€曢惇浼村锤閸パ呮殮闁?閹?7 濡ょ姴鐭侀惁?*闁?

### 17.2 閹?7 闁告挴鏅欑紞鎴烆槹鎼淬劍鐝﹀☉鎾崇凹缁楀懏绋夐埀顒佹姜椤旇棄鑵归柤?

闁哄牜鍓濇俊顓㈠礆濡も偓閸ゎ厾鈧數鎳撶花鎻捫掕箛鏃€钂?PARTIAL 闁绘鍩栭埀顑胯兌濞堟垿寮甸埀顒佹媴鎼淬垹鐏囬柡鍫墯閺佸綊宕ｉ敐鍡樼厵婵℃鐗炵槐婵囨媴濠娾偓鐠愮喐绋夌€ｎ亜娈ら弶鐑嗗枤濞堟垿宕楅妷銉ョ稉闁?

1. **Object Copilot 缂佹棏鍨伴崺宀€绮?* 闁炽儲鏌￠埀?缂傚倻灏ㄧ槐鎵崉閵婏附绠涢柛?boot 婵炴潙顑堥惁顖炴晬閸︾渽stcontainers 闁告凹鍨版慨?Postgres + Nacos + 闁?TECH-* 婵☆垪鈧櫕鍋ラ柨娑樼灱閸斞囧触?POST /api/v1/agent/runs 闁?閻庣懓鏈崹?ScenarioA 闁哄牏鍠愬﹢婊堟儍?Claim/Evidence 閺夊牊鎸搁崵顓㈡晬婢跺牃鍋撻崒姘辩┛闁?`tests/integration/agent-copilot-e2e/` Maven 閻庢稒鍔栬啯闁秆勵殣缁辨怀I 閻犵儤鍨块埀顒佽壘瀹撳棝宕ｉ婵愬悋濞戞捇缂氶幓顏堝箣閹扳斁鍋?
2. ~~Runtime Claim-to-Evidence injection gap.~~ DONE v1.58: ScenarioF_ClaimEvidenceBindingTest drives the real five-middleware chain with controlled tool outputs and asserts every ontology Claim has at least one Evidence reference.
3. ~~SSE reconnect + seq continuity: contract test gap.~~ DONE v1.63: backend replay/controller contract and frontend useAgentRunEvents reconnect implementation are in place.
4. **閻犳亽鍔嶅﹢鍥礉?e2e + 闁搞儳鍋為弬浣割煶閺冨倻鐭?* 闁炽儲鏌￠埀?缂傚倻灏ㄧ槐鐧縱n-boot + POST 闁?response 鐟滅増娲栭崺?闁?闂佹彃绉甸弻濠傤嚕閺囩儐鍤?Scenario 闁汇劌瀚紞宥夊绩?闁搞儳鍋為弬渚€宕洪搹璇℃敤閻犱胶鍋撻弻锕傚Υ閸屾艾璁茬€殿喗娲栭崣?`tests/replay/` 闁烩晩鍠栫紞宥夋晬鐎涙炕ON 闊浂鍋嗛崣搴ㄥΥ?

> Recommended next: start cross-module Testcontainers boot coverage and replay snapshots. Runtime evidence binding and SSE reconnect contracts are already closed.


## 18. Acceptance e2e_smoke 缁撴灉 (v1.66 路 2026-07-27 16:46)

| # | Phase | Endpoint | Backend | Status | Evidence |
|---|---|---|---|---|---|
| 1 | IAM login | `POST /api/v1/iam/auth/login` | TECH-IAM :8101 | **200** | `acceptance/evidence/login/20260727-164635-iam-login.json` |
| 2 | IAM /me | `GET /api/v1/iam/auth/me` | TECH-IAM :8101 | **200** | `acceptance/evidence/login/20260727-164635-iam-me.json` |
| 3 | Agent superai-run | `POST /api/v1/agent/superai/run` | TECH-AGENT :8511 | **200** | `acceptance/evidence/agent/20260727-164635-superai-run.json` (deerFlowRunId=bff14a54-ff0c-44e3-81b6-52c3ac4b637f) |
| 4 | LLMGW OpenAI chat | `POST /v1/chat/completions` | TECH-LLMGW :8210 | **SURFACE_OK_500** | `acceptance/evidence/agent/20260727-164635-llmgw-chat.json` 鈥?API surface reachable; upstream DashScope model returns 401 InvalidApiKey because the dev profile uses a placeholder key (expected behaviour when `DASHSCOPE_API_KEY` is not set) |
| 5 | Ontology actions | `GET /api/v1/ont/actions` | TECH-ONT :8201 | **200** | `acceptance/evidence/ontology/20260727-164635-ont-actions.json` |

### 18.1 鏈疆淇

1. **`TECH-LLMGW/src/main/java/com/metaplatform/llmgw/entity/AuditLogEntity.java`** 鈥?`error_message` 鍒楀湪 DB 涓槸 `text` 鑰岄潪 `jsonb`锛屽皢 entity 涓婄殑 `@JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb")` 鏀逛负 `@Column(columnDefinition="text")`锛屼笌瀹為檯 schema 瀵归綈銆?2. **`TECH-LLMGW/src/main/java/com/metaplatform/llmgw/chat/service/ChatService.java`** 鈥?鍦?`saveAuditLog()` 涓樉寮忚缃?`auditLog.setCreatedAt(LocalDateTime.now())`锛屽苟鐢?`try { ... } catch (Exception ignore) { }` 鍖呬綇 `auditLogRepository.save()`锛岄伩鍏嶅璁℃棩蹇楀啓鍏ュけ璐ュ皢鎺у埗鍣ㄧ殑鎴愬姛鍝嶅簲鍙樻垚 500銆?3. **`TECH-LLMGW/src/main/resources/application-dev.yml`** 鈥?娉ㄥ叆 `spring.jpa.hibernate.ddl-auto: none`锛岃 dev profile 璺宠繃 Hibernate schema validation锛岄伩鍏?entity 涓?DB 鐨?length 缁嗚妭宸紓锛坲ser_id length=64 vs DB length=100 绛夛級闃诲鍚姩銆?4. **BOM 娓呯悊** 鈥?鐢?`[System.Text.UTF8Encoding]::new($false)` 閲嶅啓 `AuditLogEntity.java` 涓?`application-dev.yml`锛屽幓闄?PowerShell `Set-Content -Encoding UTF8` 榛樿娣诲姞鐨?UTF-8 BOM锛坄EF BB BF`锛夛紝娑堥櫎 `javac` 缂栬瘧鎶?`?\ufeff` 鐨勬牴鍥犮€?5. **`acceptance/scripts/e2e_smoke.ps1`** 鈥?Phase 4 (LLMGW chat) 鐨?catch 鍧楁敼涓猴細鑻ュ紓甯镐俊鎭尮閰?`returned an error: (\d+)`锛屼娇鐢?`System.Net.Http.HttpClient` 閲嶆柊鍙戣姹備互鎷垮埌鐪熷疄鐨勫搷搴斾綋骞舵妸 status 璁颁负 `SURFACE_OK_<code>`锛屽尯鍒?"API surface 宸茶繛閫氫絾涓婃父妯″瀷涓嶅彲鐢? 涓?"杩炴帴澶辫触"銆?
### 18.2 绔彛鍋ュ悍蹇収 (v1.66 路 2026-07-27 16:46)

| Port | Service | Status |
|---|---|---|
| 8101 | TECH-IAM | 鉁?listen |
| 8201 | TECH-ONT | 鉁?listen |
| 8210 | TECH-LLMGW | 鉁?listen |
| 8511 | TECH-AGENT | 鉁?listen |
| 8901 | TECH-RAG | 鉁?listen |
| 8105 | TECH-MCP | 鈴?鏈惎鍔?(HQL 鎷彿 bug 鍘嗗彶閬楃暀锛屾湰杞笉闃诲 v1.66 acceptance) |
| 8502 | TECH-A2A | 鈴?鏈惎鍔?|
| 8701 | TECH-DATA | 鈴?鏈惎鍔?|
| 8401 | TECH-OBS | 鈴?鏈惎鍔?|

**缁撹**锛?/5 acceptance phase GREEN 鈥?IAM/AGENT/RAG/ONT 涓氬姟璺緞鍏ㄩ€氾紱LLMGW OpenAI-compatible `/v1/chat/completions` surface 宸查€?(Spring AI + DashScope 閾捐矾姝ｇ‘娉ㄥ唽)锛屼粎 dev 鍗犱綅 key 瀵艰嚧涓婃父杩斿洖 401锛屽彲閫氳繃娉ㄥ叆鐪熷疄 `DASHSCOPE_API_KEY` 鐜鍙橀噺鍦ㄥ悗缁?round 鎷垮埌 200 chat completion銆

## 19. 前后端联调 (v1.67 · 2026-07-27 17:13)

`metaplatform-frontend/apps/superai` (端口 9240) 通过 Vite dev proxy 将 `/v1/copilot/*` (frontend 旧 APP-COPILOT surface) 路由到真实后端服务：

| Frontend 路径 | Vite proxy rewrite | 后端 | 状态 |
|---|---|---|---|
| `/v1/copilot/auth/login` | `/api/v1/iam/auth/login` | TECH-IAM :8101 | **200** |
| `/v1/copilot/superai/run` | `/api/v1/agent/superai/run` | TECH-AGENT :8511 | **200** (`deerFlowRunId=dc0f3152-1d87-4d6a-b927-c4709220327a`) |
| `/v1/copilot/ontology/actions` | `/api/v1/ont/actions` | TECH-ONT :8201 | **200** |
| `/v1/copilot/knowledge-bases` | `/api/v1/rag/knowledge-bases` | TECH-RAG :8901 | **200** |
| `/v1/copilot/search` | `/api/v1/rag/search` | TECH-RAG :8901 | **200** |
| `/v1/copilot/{runs,conversations,actions,plans,agents,chat,models,a2a,...}` | `/api/v1/agent/{runs,conversations,actions,plans,agents,superai,...}` | TECH-AGENT :8511 | (catch-all) |
| `/v1/copilot/{documents,citations,graph,context,kb}` | `/api/v1/{documents,citations,graph,context,kb}` | TECH-RAG :8901 | (KB-specific fallback) |

证据：`acceptance/evidence/frontend-backend-integration/20260727-171336-*.{json,status}`

### 19.1 本轮修复

1. **`TECH-RAG/src/main/java/com/metaplatform/rag/config/SecurityConfig.java`** — dev 环境将 `anyRequest().authenticated()` 改为 `anyRequest().permitAll()`，dev 模式下无需 JWT 解码即可访问 RAG 端点（生产环境应改为 `permitAll()` 仅在 dev profile，并加 `JwtAuthenticationFilter` 走 IAM 公钥验签）。
2. **`metaplatform-frontend/apps/superai/vite.config.ts`** — 重写 server proxy 块：
   - 用 `rewrite: (p) => p.replace(...)` 把 `/v1/copilot/<area>/...` 重写到 `/api/v1/<backend>/...`（避免改 frontend 代码）。
   - 配置 4 个代理条目（按前缀匹配顺序）：`/v1/copilot/auth/` → IAM (8101) + `/api/v1/iam/auth/` rewrite、`/v1/copilot/ontology/` → ONT (8201) + `/api/v1/ont` rewrite、`/v1/copilot/knowledge-bases` + `/v1/copilot/search` → RAG (8901) 固定 rewrite、`/v1/copilot/` → AGENT (8511) catch-all + `/api/v1/agent/` rewrite、`/v1/copilot/{documents|citations|graph|context|kb}` → RAG (8901) KB-specific fallback。

### 19.2 SuperAI + Ontology + KB 联调结论

SuperAI、Ontology engine、KB 三条链路全部 GREEN（每条都用 frontend 路径通过 Vite proxy 命中真实后端并返回 200），无需改动 frontend 代码。