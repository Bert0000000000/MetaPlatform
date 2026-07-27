package com.metaplatform.msg.service;

import com.metaplatform.msg.common.ErrorCode;
import com.metaplatform.msg.common.MsgException;
import com.metaplatform.msg.common.PageResponse;
import com.metaplatform.msg.dto.OutboxResponse;
import com.metaplatform.msg.dto.OutboxStatsResponse;
import com.metaplatform.msg.entity.OutboxMessageEntity;
import com.metaplatform.msg.repository.OutboxMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class OutboxService {

    private final OutboxMessageRepository outboxRepository;
    private final OutboxRelayService outboxRelayService;

    public OutboxStatsResponse getStats() {
        List<Object[]> counts = outboxRepository.countByStatus();
        long pending = 0, sent = 0, failed = 0;

        for (Object[] row : counts) {
            OutboxMessageEntity.OutboxStatus status = (OutboxMessageEntity.OutboxStatus) row[0];
            long count = (Long) row[1];
            switch (status) {
                case PENDING -> pending = count;
                case SENT -> sent = count;
                case FAILED -> failed = count;
            }
        }

        return OutboxStatsResponse.builder()
                .pending(pending)
                .sent(sent)
                .failed(failed)
                .total(pending + sent + failed)
                .build();
    }

    public PageResponse<OutboxResponse> listOutbox(String status, int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);
        Page<OutboxMessageEntity> entityPage;

        if (status != null && !status.isBlank()) {
            OutboxMessageEntity.OutboxStatus outboxStatus = parseStatus(status);
            entityPage = outboxRepository.findByStatus(outboxStatus, pageable);
        } else {
            entityPage = outboxRepository.findAll(pageable);
        }

        List<OutboxResponse> items = entityPage.getContent().stream()
                .map(OutboxResponse::from)
                .toList();

        return PageResponse.<OutboxResponse>builder()
                .items(items)
                .total(entityPage.getTotalElements())
                .page(page)
                .size(size)
                .totalPages(entityPage.getTotalPages())
                .build();
    }

    public OutboxResponse getOutbox(String id) {
        OutboxMessageEntity entity = outboxRepository.findById(id)
                .orElseThrow(() -> new MsgException(ErrorCode.OUTBOX_NOT_FOUND, "Outbox 消息不存在: " + id));
        return OutboxResponse.from(entity);
    }

    public boolean retry(String id) {
        return outboxRelayService.manualRetry(id);
    }

    private OutboxMessageEntity.OutboxStatus parseStatus(String status) {
        try {
            return OutboxMessageEntity.OutboxStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new MsgException(ErrorCode.INVALID_PARAM, "无效的状态值: " + status);
        }
    }
}
