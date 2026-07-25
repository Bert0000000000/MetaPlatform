package com.metaplatform.msg.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.msg.common.ErrorCode;
import com.metaplatform.msg.common.MsgException;
import com.metaplatform.msg.realtime.dto.BroadcastRequest;
import com.metaplatform.msg.realtime.dto.SendToUserRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RealtimePushController.class)
@AutoConfigureMockMvc(addFilters = false)
class RealtimePushControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private WebSocketConnectionManager connectionManager;

    @MockitoBean
    private RealtimePushService realtimePushService;

    @Test
    void getConnections_shouldReturnStats() throws Exception {
        when(connectionManager.getConnectionCount()).thenReturn(5);
        when(connectionManager.getOnlineUserCount()).thenReturn(3);
        when(realtimePushService.getValidChannels())
                .thenReturn(Set.of("metrics", "notifications", "deliverables"));

        mockMvc.perform(get("/api/v1/msg/realtime/connections"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.totalConnections").value(5))
                .andExpect(jsonPath("$.data.onlineUsers").value(3));
    }

    @Test
    void getConnection_shouldReturnOnlineInfo_whenUserOnline() throws Exception {
        WebSocketConnectionManager.UserConnectionInfo info =
                new WebSocketConnectionManager.UserConnectionInfo(
                        "user-1", true, 1,
                        List.of(new WebSocketConnectionManager.SessionSummary(
                                "sess-1", "tenant-1", Instant.now())));
        when(connectionManager.getConnectionInfo("user-1")).thenReturn(info);

        mockMvc.perform(get("/api/v1/msg/realtime/connections/user-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.userId").value("user-1"))
                .andExpect(jsonPath("$.data.online").value(true))
                .andExpect(jsonPath("$.data.sessionCount").value(1))
                .andExpect(jsonPath("$.data.sessions[0].sessionId").value("sess-1"));
    }

    @Test
    void getConnection_shouldReturnOfflineInfo_whenUserOffline() throws Exception {
        WebSocketConnectionManager.UserConnectionInfo info =
                new WebSocketConnectionManager.UserConnectionInfo(
                        "offline-user", false, 0, List.of());
        when(connectionManager.getConnectionInfo("offline-user")).thenReturn(info);

        mockMvc.perform(get("/api/v1/msg/realtime/connections/offline-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.online").value(false))
                .andExpect(jsonPath("$.data.sessionCount").value(0));
    }

    @Test
    void broadcast_shouldReturn200_whenChannelValid() throws Exception {
        BroadcastRequest request = new BroadcastRequest("metrics", Map.of("value", 42));
        when(realtimePushService.broadcast(eq("metrics"), any()))
                .thenReturn("/topic/dashboard/metrics");
        when(connectionManager.getConnectionCount()).thenReturn(5);

        mockMvc.perform(post("/api/v1/msg/realtime/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.channel").value("metrics"))
                .andExpect(jsonPath("$.data.sent").value(true))
                .andExpect(jsonPath("$.data.destination").value("/topic/dashboard/metrics"))
                .andExpect(jsonPath("$.data.estimatedRecipients").value(5));
    }

    @Test
    void broadcast_shouldReturn422_whenChannelInvalid() throws Exception {
        BroadcastRequest request = new BroadcastRequest("invalid-channel", Map.of("value", 1));
        when(realtimePushService.broadcast(eq("invalid-channel"), any()))
                .thenThrow(new MsgException(ErrorCode.INVALID_CHANNEL, "非法推送频道: invalid-channel"));

        mockMvc.perform(post("/api/v1/msg/realtime/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(42202));
    }

    @Test
    void broadcast_shouldReturn400_whenChannelBlank() throws Exception {
        BroadcastRequest request = new BroadcastRequest("", Map.of("value", 1));

        mockMvc.perform(post("/api/v1/msg/realtime/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void sendToUser_shouldReturn200_whenUserOnline() throws Exception {
        SendToUserRequest request = new SendToUserRequest("/queue/notifications", Map.of("msg", "hello"));
        when(realtimePushService.sendToUser(eq("user-1"), eq("/queue/notifications"), any()))
                .thenReturn(2);

        mockMvc.perform(post("/api/v1/msg/realtime/users/user-1/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.userId").value("user-1"))
                .andExpect(jsonPath("$.data.destination").value("/queue/notifications"))
                .andExpect(jsonPath("$.data.sent").value(true))
                .andExpect(jsonPath("$.data.sessionCount").value(2));
    }

    @Test
    void sendToUser_shouldReturn404_whenUserNotConnected() throws Exception {
        SendToUserRequest request = new SendToUserRequest("/queue/notifications", Map.of("msg", "hello"));
        when(realtimePushService.sendToUser(eq("offline-user"), anyString(), any()))
                .thenThrow(new MsgException(ErrorCode.WEBSOCKET_USER_NOT_CONNECTED,
                        "用户未连接 WebSocket: offline-user"));

        mockMvc.perform(post("/api/v1/msg/realtime/users/offline-user/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(40406));
    }

    @Test
    void sendToUser_shouldReturn400_whenDestinationBlank() throws Exception {
        SendToUserRequest request = new SendToUserRequest("", Map.of("msg", "hello"));

        mockMvc.perform(post("/api/v1/msg/realtime/users/user-1/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }
}
