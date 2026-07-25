package com.metaplatform.data.deliverables;

import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.config.MinioConfig;
import com.metaplatform.data.deliverables.dto.CreateDeliverableRequest;
import com.metaplatform.data.deliverables.dto.DeliverableResponse;
import com.metaplatform.data.entity.DeliverableEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.repository.DeliverableRepository;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.http.Method;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * 交付物服务：CRUD + MinIO 对象存储集成（presigned URL + 上传）。
 *
 * <p>对应 Python app/deliverables/service.py 的 DeliverableService。</p>
 *
 * <p>持久化存储（deliverable 表），状态字段支持 ready/building/failed。
 * MinIO 用于实际交付物文件存储，提供 7 天有效的 presigned 下载 URL。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeliverableService {

    private static final String DEFAULT_STATUS = "ready";
    private static final int PRESIGNED_URL_EXPIRY_DAYS = 7;
    private static final String FALLBACK_DOWNLOAD_PATH = "/api/v1/data/deliverables/";

    private final DeliverableRepository deliverableRepository;
    private final MinioClient minioClient;
    private final MinioConfig minioConfig;

    /**
     * 启动时确保默认 bucket 存在。
     *
     * <p>MinIO 不可达时记录 WARN 日志但不阻止启动（下载/上传时再降级处理）。</p>
     */
    @PostConstruct
    void init() {
        String bucket = minioConfig.getBucket();
        try {
            boolean exists = minioClient.bucketExists(
                    BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                log.info("MinIO bucket 创建 | bucket={}", bucket);
            }
            log.info("MinIO bucket 就绪 | bucket={}", bucket);
        } catch (Exception e) {
            log.warn("MinIO bucket 初始化失败，交付物上传/下载将降级 | bucket={} error={}",
                    bucket, e.getMessage());
        }
    }

    @Transactional
    public DeliverableResponse create(CreateDeliverableRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        String createdBy = request.getCreatedBy() != null ? request.getCreatedBy()
                : (TenantContext.getUserId() != null ? TenantContext.getUserId() : "system");
        DeliverableEntity entity = new DeliverableEntity();
        entity.setId(newDeliverableId());
        entity.setTenantId(tenantId);
        entity.setType(request.getType());
        entity.setTitle(request.getTitle());
        entity.setSource(request.getSource());
        entity.setDescription(request.getDescription());
        entity.setFormat(request.getFormat());
        entity.setStatus(DEFAULT_STATUS);
        entity.setSize(0);
        entity.setCreatedBy(createdBy);
        entity.setDownloadUrl(null);

        DeliverableEntity saved = deliverableRepository.save(entity);
        log.info("交付物创建 | tenant={} id={} type={} title={}",
                tenantId, saved.getId(), saved.getType(), saved.getTitle());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<DeliverableResponse> list(String type, String source, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<DeliverableEntity> result;
        if (type != null && !type.isBlank() && source != null && !source.isBlank()) {
            result = deliverableRepository.findByTenantIdAndTypeAndSource(tenantId, type, source, pageable);
        } else if (type != null && !type.isBlank()) {
            result = deliverableRepository.findByTenantIdAndType(tenantId, type, pageable);
        } else {
            result = deliverableRepository.findByTenantId(tenantId, pageable);
        }

        return PageResponse.of(result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    @Transactional(readOnly = true)
    public DeliverableResponse get(String deliverableId) {
        return toResponse(requireDeliverable(deliverableId));
    }

    @Transactional
    public boolean delete(String deliverableId) {
        DeliverableEntity entity = requireDeliverable(deliverableId);
        deliverableRepository.delete(entity);
        log.info("交付物删除 | id={}", deliverableId);
        return true;
    }

    /**
     * 获取下载 URL。
     *
     * <p>优先返回 MinIO presigned URL（7 天有效）；若 objectKey 为空（尚未上传文件），
     * 回退到内部代理路径 {@code /api/v1/data/deliverables/{id}/content}。</p>
     */
    @Transactional
    public String getDownloadUrl(String deliverableId) {
        DeliverableEntity entity = requireDeliverable(deliverableId);
        String objectKey = entity.getObjectKey();
        String bucket = entity.getBucket() != null && !entity.getBucket().isBlank()
                ? entity.getBucket()
                : minioConfig.getBucket();

        if (objectKey == null || objectKey.isBlank()) {
            // 未上传到 MinIO，回退到内部代理路径
            String fallbackUrl = FALLBACK_DOWNLOAD_PATH + deliverableId + "/content";
            if (entity.getDownloadUrl() == null || entity.getDownloadUrl().isBlank()) {
                entity.setDownloadUrl(fallbackUrl);
                deliverableRepository.save(entity);
            }
            return fallbackUrl;
        }

        try {
            String presignedUrl = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .method(Method.GET)
                            .expiry(PRESIGNED_URL_EXPIRY_DAYS, TimeUnit.DAYS)
                            .build());
            // 更新持久化的 downloadUrl（便于审计/列表展示）
            entity.setDownloadUrl(presignedUrl);
            deliverableRepository.save(entity);
            log.info("Presigned URL 生成 | id={} bucket={} objectKey={} expiryDays={}",
                    deliverableId, bucket, objectKey, PRESIGNED_URL_EXPIRY_DAYS);
            return presignedUrl;
        } catch (Exception e) {
            log.error("MinIO presigned URL 生成失败 | id={} bucket={} objectKey={} error={}",
                    deliverableId, bucket, objectKey, e.getMessage());
            throw new DataException(ErrorCode.MINIO_OPERATION_FAILED,
                    "生成下载 URL 失败: " + e.getMessage(), e);
        }
    }

    /**
     * 生成 presigned 下载 URL（不修改实体，只读取）。
     *
     * @param deliverableId 交付物 ID
     * @return presigned URL；若未上传文件则回退到内部路径
     */
    @Transactional(readOnly = true)
    public String generatePresignedDownloadUrl(String deliverableId) {
        DeliverableEntity entity = requireDeliverable(deliverableId);
        String objectKey = entity.getObjectKey();
        if (objectKey == null || objectKey.isBlank()) {
            return FALLBACK_DOWNLOAD_PATH + deliverableId + "/content";
        }

        String bucket = entity.getBucket() != null && !entity.getBucket().isBlank()
                ? entity.getBucket()
                : minioConfig.getBucket();

        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .method(Method.GET)
                            .expiry(PRESIGNED_URL_EXPIRY_DAYS, TimeUnit.DAYS)
                            .build());
        } catch (Exception e) {
            log.error("MinIO presigned URL 生成失败 | id={} bucket={} objectKey={} error={}",
                    deliverableId, bucket, objectKey, e.getMessage());
            throw new DataException(ErrorCode.MINIO_OPERATION_FAILED,
                    "生成 presigned URL 失败: " + e.getMessage(), e);
        }
    }

    /**
     * 上传交付物文件到 MinIO 并更新实体元数据。
     *
     * <p>objectKey 格式：{@code deliverables/{tenantId}/{deliverableId}/{filename}}，
     * filename 由 deliverableId + format 派生。</p>
     *
     * @param deliverableId 交付物 ID
     * @param content       文件输入流
     * @param size          文件大小（字节）；-1 表示未知
     * @param contentType   MIME 类型（可为 null）
     */
    @Transactional
    public DeliverableResponse uploadDeliverable(String deliverableId,
                                                 InputStream content,
                                                 long size,
                                                 String contentType) {
        DeliverableEntity entity = requireDeliverable(deliverableId);
        String tenantId = entity.getTenantId();
        String format = entity.getFormat() != null && !entity.getFormat().isBlank()
                ? entity.getFormat()
                : "bin";
        String filename = buildFilename(deliverableId, format);
        String objectKey = String.join("/",
                "deliverables", tenantId, deliverableId, filename);
        String bucket = minioConfig.getBucket();

        try {
            long partSize = (size > 0) ? -1 : 10 * 1024 * 1024L; // 已知大小用 -1，未知用 10MB 分片
            long objectSize = (size > 0) ? size : -1;
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .stream(content, objectSize, partSize)
                            .contentType(contentType != null ? contentType : "application/octet-stream")
                            .build());

            entity.setObjectKey(objectKey);
            entity.setBucket(bucket);
            if (size > 0 && size <= Integer.MAX_VALUE) {
                entity.setSize((int) size);
            }
            entity.setStatus("ready");
            // 清空缓存的 downloadUrl，下次获取时重新生成 presigned URL
            entity.setDownloadUrl(null);
            DeliverableEntity saved = deliverableRepository.save(entity);

            log.info("交付物文件上传 MinIO | id={} bucket={} objectKey={} size={} contentType={}",
                    deliverableId, bucket, objectKey, size, contentType);
            return toResponse(saved);
        } catch (Exception e) {
            log.error("MinIO 上传失败 | id={} bucket={} objectKey={} error={}",
                    deliverableId, bucket, objectKey, e.getMessage());
            throw new DataException(ErrorCode.MINIO_OPERATION_FAILED,
                    "交付物上传失败: " + e.getMessage(), e);
        }
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private DeliverableEntity requireDeliverable(String id) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return deliverableRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.QUERY_NOT_FOUND, "交付物不存在: " + id));
    }

    private DeliverableResponse toResponse(DeliverableEntity entity) {
        return DeliverableResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .type(entity.getType())
                .title(entity.getTitle())
                .source(entity.getSource())
                .description(entity.getDescription())
                .format(entity.getFormat())
                .status(entity.getStatus())
                .size(entity.getSize())
                .createdBy(entity.getCreatedBy())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .downloadUrl(entity.getDownloadUrl())
                .build();
    }

    /**
     * 构造上传文件名：{deliverableId}.{format}（format 含点号则不重复添加）。
     */
    private static String buildFilename(String deliverableId, String format) {
        String safeFormat = format == null || format.isBlank() ? "bin" : format.trim().toLowerCase();
        if (safeFormat.startsWith(".")) {
            return deliverableId + safeFormat;
        }
        return deliverableId + "." + safeFormat;
    }

    private static String newDeliverableId() {
        return "dlv-" + UUID.randomUUID().toString().replace("-", "");
    }
}
