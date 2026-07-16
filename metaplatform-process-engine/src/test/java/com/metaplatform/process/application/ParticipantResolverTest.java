package com.metaplatform.process.application;

import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.dsl.AssigneeConfig;
import com.metaplatform.process.domain.enums.AssigneeType;
import com.metaplatform.process.infrastructure.exception.ParticipantResolutionException;
import com.metaplatform.process.infrastructure.util.JsonUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ParticipantResolverTest {

    private ParticipantResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new ParticipantResolver();
    }

    @Test
    void resolveUserType() {
        AssigneeConfig config = new AssigneeConfig(AssigneeType.USER, "user01");
        ProcessInstance instance = createInstance(Map.of());

        String result = resolver.resolve(config, instance);
        assertEquals("user01", result);
    }

    @Test
    void resolveRoleType() {
        AssigneeConfig config = new AssigneeConfig(AssigneeType.ROLE, "MANAGER");
        ProcessInstance instance = createInstance(Map.of());

        String result = resolver.resolve(config, instance);
        assertEquals("MANAGER", result);
    }

    @Test
    void resolveExpressionWithGetInitiator() {
        AssigneeConfig config = new AssigneeConfig(AssigneeType.EXPRESSION, "getInitiator()");
        ProcessInstance instance = createInstance(Map.of());
        instance.setInitiatorId("user02");

        String result = resolver.resolve(config, instance);
        assertEquals("user02", result);
    }

    @Test
    void resolveExpressionWithGetVariable() {
        AssigneeConfig config = new AssigneeConfig(AssigneeType.EXPRESSION, "getVariable('approver')");
        Map<String, Object> variables = new HashMap<>();
        variables.put("approver", "manager01");
        ProcessInstance instance = createInstance(variables);

        String result = resolver.resolve(config, instance);
        assertEquals("manager01", result);
    }

    @Test
    void resolveNullConfigThrows() {
        ProcessInstance instance = createInstance(Map.of());
        assertThrows(ParticipantResolutionException.class,
            () -> resolver.resolve(null, instance));
    }

    @Test
    void resolveEmptyUserIdThrows() {
        AssigneeConfig config = new AssigneeConfig(AssigneeType.USER, "");
        ProcessInstance instance = createInstance(Map.of());

        assertThrows(ParticipantResolutionException.class,
            () -> resolver.resolve(config, instance));
    }

    @Test
    void resolveEmptyRoleNameThrows() {
        AssigneeConfig config = new AssigneeConfig(AssigneeType.ROLE, "");
        ProcessInstance instance = createInstance(Map.of());

        assertThrows(ParticipantResolutionException.class,
            () -> resolver.resolve(config, instance));
    }

    @Test
    void resolveEmptyExpressionThrows() {
        AssigneeConfig config = new AssigneeConfig(AssigneeType.EXPRESSION, "");
        ProcessInstance instance = createInstance(Map.of());

        assertThrows(ParticipantResolutionException.class,
            () -> resolver.resolve(config, instance));
    }

    private ProcessInstance createInstance(Map<String, Object> variables) {
        ProcessInstance instance = new ProcessInstance();
        instance.setId(1L);
        instance.setInitiatorId("user01");
        instance.setVariablesJson(JsonUtils.toJson(variables));
        return instance;
    }
}
