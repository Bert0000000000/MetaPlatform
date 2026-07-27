package com.metaplatform.agent.middleware;

import com.metaplatform.agent.context.OntologyContextEnvelope;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.*;

/**
 * Middleware Context閿涘湧3.1閿涘鈧? *
 * <p>鐠愵垳鈹涢弫瀛樻蒋 Middleware Chain 閻ㄥ嫪绗傛稉瀣瀮鐎电钖勯妴鍌涘閺?Middleware 閸忓彉闊╂稉鈧稉顏勭杽娓氬鈧?/p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MiddlewareContext {

    private String tenantId;
    private String userId;
    private String agentId;
    private String threadId;
    private String runId;

    /** 閸樼喎顫愰悽銊﹀煕濞戝牊浼?*/
    private String userMessage;

    /** Ontology Context Envelope閿涘牊娼甸懛?TECH-ONT /ont/context/build閿?*/
    private Map<String, Object> ontologyEnvelope;

    /** Server-built, signed ontology context used by every runtime/tool. */
    private OntologyContextEnvelope ontologyContext;

    /** Allowed Tools */
    private List<String> allowedTools;

    /** 瑜版挸澧?Grounding 缂佹挻鐏?*/
    private Map<String, Object> grounding;

    /** 瀹稿弶鏁归梿鍡欐畱 Claims 娑?Evidence */
    private List<Map<String, Object>> claims;

    /** 瀵板懎顦╅悶鍡欐畱 Action Proposals */
    private List<Map<String, Object>> actionProposals;

    /** 娴犺缍嶆稉顓㈡？娴犺泛褰茬拋鍓х枂閻ㄥ嫭瀚嗙紒婵嗗斧閸?*/
    private String rejectionReason;
    private boolean rejected;
}
