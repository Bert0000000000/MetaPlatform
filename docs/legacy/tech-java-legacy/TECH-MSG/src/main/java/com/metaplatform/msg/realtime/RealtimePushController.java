package com.metaplatform.msg.realtime;

import com.metaplatform.msg.common.ApiResponse;
import com.metaplatform.msg.realtime.dto.BroadcastRequest;
import com.metaplatform.msg.realtime.dto.BroadcastResponse;
import com.metaplatform.msg.realtime.dto.ConnectionInfoResponse;
import com.metaplatform.msg.realtime.dto.ConnectionStatsResponse;
import com.metaplatform.msg.realtime.dto.SendResponse;
import com.metaplatform.msg.realtime.dto.SendToUserRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 实时推流管理端点（P0-5）。
 *
 * <p>路径：{@code /api/v1/msg/realtime}</p>
 *
 * <p>提供 WebSocket 连接查询、消息广播与定向推送能力。</p>
 */
@RestController
@RequestMapping("/api/v1/msg/realtime")
@RequiredArgsConstructor
public class RealtimePushController {

    private final WebSocketConnectionManager connectionManager;
    private final RealtimePushService realtimePushService;

    /**
     * 获取当前 WebSocket 连接统计。
     */
    @GetMapping("/connections")
    public ApiResponse<ConnectionStatsResponse> getConnections() {
        return ApiResponse.success(new ConnectionStatsResponse(
                connectionManager.getConnectionCount(),
                connectionManager.getOnlineUserCount(),
                List.copyOf(realtimePushService.getValidChannels())));
    }

    /**
     * 获取指定用户的连接状态。
     */
    @GetMapping("/connections/{userId}")
    public ApiResponse<ConnectionInfoResponse> getConnection(@PathVariable String userId) {
        WebSocketConnectionManager.UserConnectionInfo info = connectionManager.getConnectionInfo(userId);
        List<ConnectionInfoResponse.SessionDetail> details = info.sessions().stream()
                .map(s -> new ConnectionInfoResponse.SessionDetail(s.sessionId(), s.tenantId(), s.connectedAt()))
                .toList();
        return ApiResponse.success(new ConnectionInfoResponse(
                info.userId(), info.online(), info.sessionCount(), details));
    }

    /**
     * 广播消息到指定频道（管理员）。
     */
    @PostMapping("/broadcast")
    public ApiResponse<BroadcastResponse> broadcast(@Valid @RequestBody BroadcastRequest request) {
        String destination = realtimePushService.broadcast(request.channel(), request.payload());
        return ApiResponse.success(new BroadcastResponse(
                request.channel(), true, destination, connectionManager.getConnectionCount()));
    }

    /**
     * 向指定用户推送消息。
     */
    @PostMapping("/users/{userId}/send")
    public ApiResponse<SendResponse> sendToUser(
            @PathVariable String userId,
            @Valid @RequestBody SendToUserRequest request) {
        int sessionCount = realtimePushService.sendToUser(userId, request.destination(), request.payload());
        return ApiResponse.success(new SendResponse(userId, request.destination(), true, sessionCount));
    }
}
