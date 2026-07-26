package com.metaplatform.action.verification;

import com.metaplatform.action.policy.ActionPolicyService;
import com.metaplatform.action.policy.ActionPolicyService.Decision;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 场景 C：受控 Action 执行 — ActionPolicy 单元验证。
 *
 * <p>验收标准来自 §9.3。</p>
 */
@DisplayName("Scenario C · 受控 Action 执行 (ActionPolicy)")
class ActionPolicyVerification {

    private ActionPolicyService newServiceWithLoadedPolicy() throws Exception {
        ActionPolicyService svc = new ActionPolicyService();
        Method load = ActionPolicyService.class.getDeclaredMethod("load");
        load.setAccessible(true);
        load.invoke(svc);
        return svc;
    }

    @Test
    @DisplayName("C1: CreateFollowUpTask × LOW 风险 → AUTO")
    void lowRiskAutoExecutes() throws Exception {
        ActionPolicyService svc = newServiceWithLoadedPolicy();
        Decision d = svc.decide("CreateFollowUpTask", "LOW", List.of("ACCOUNT_MANAGER"));
        assertEquals("AUTO", d.type(), "低风险任务应直接执行");
    }

    @Test
    @DisplayName("C2: RequestDiscount × HIGH 风险 → APPROVAL")
    void highRiskRequiresApproval() throws Exception {
        ActionPolicyService svc = newServiceWithLoadedPolicy();
        Decision d = svc.decide("RequestDiscount", "HIGH", List.of("SALES_MANAGER"));
        assertEquals("APPROVAL", d.type(), "高风险 Action 必须经人工审批");
    }

    @Test
    @DisplayName("C3: ModifyContract × CRITICAL 风险 → REJECT")
    void criticalRiskDefaultRejected() throws Exception {
        ActionPolicyService svc = newServiceWithLoadedPolicy();
        Decision d = svc.decide("ModifyContract", "CRITICAL", List.of("ADMIN"));
        assertEquals("REJECT", d.type(), "CRITICAL 风险应默认拒绝");
    }

    @Test
    @DisplayName("C4: GUEST 角色执行 ChangeDiscount 一律 REJECT")
    void guestRoleHardBlocked() throws Exception {
        ActionPolicyService svc = newServiceWithLoadedPolicy();
        Decision d = svc.decide("ChangeDiscount", "HIGH", List.of("GUEST"));
        assertEquals("REJECT", d.type(), "GUEST 角色无权执行敏感 Action");
        assertTrue(d.reason().contains("GUEST"), "拒绝原因必须说明 GUEST 角色");
    }

    @Test
    @DisplayName("C5: VIEWER 角色执行 SendOfficialOffer 一律 REJECT")
    void viewerRoleHardBlocked() throws Exception {
        ActionPolicyService svc = newServiceWithLoadedPolicy();
        Decision d = svc.decide("SendOfficialOffer", "HIGH", List.of("VIEWER"));
        assertEquals("REJECT", d.type());
        assertTrue(d.reason().contains("VIEWER"));
    }

    @Test
    @DisplayName("C6: 决策结果必须有 reason 字段（审计可追溯）")
    void decisionsAlwaysCarryReason() throws Exception {
        ActionPolicyService svc = newServiceWithLoadedPolicy();
        Decision d1 = svc.decide("NotifyOwner", "LOW", List.of("OPS"));
        Decision d2 = svc.decide("RequestDiscount", "HIGH", List.of("SALES"));
        Decision d3 = svc.decide("ModifyContract", "CRITICAL", List.of("ADMIN"));
        assertNotNull(d1.reason()); assertFalse(d1.reason().isBlank());
        assertNotNull(d2.reason()); assertFalse(d2.reason().isBlank());
        assertNotNull(d3.reason()); assertFalse(d3.reason().isBlank());
    }
}
