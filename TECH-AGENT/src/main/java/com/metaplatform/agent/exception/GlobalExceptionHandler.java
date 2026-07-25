package com.metaplatform.agent.exception;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 全局异常处理器。
 *
 * <p>统一将异常翻译为 {@link ApiResponse} 错误响应，并按 {@link ErrorCode#getHttpStatus()}
 * 设置 HTTP 状态码。所有 Controller 抛出的异常都在此处理。</p>
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 业务异常：按 ErrorCode 映射 HTTP 状态码。
     */
    @ExceptionHandler(AgentException.class)
    public ResponseEntity<ApiResponse<Void>> handleAgentException(AgentException ex, HttpServletRequest request) {
        ErrorCode code = ex.getErrorCode();
        log.warn("业务异常 | traceId={} path={} code={} msg={}",
                request.getRequestURI(), request.getRequestURI(), code.getCode(), ex.getMessage());
        HttpStatus httpStatus = HttpStatus.resolve(code.getHttpStatus());
        if (httpStatus == null) {
            httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        return ResponseEntity.status(httpStatus).body(ApiResponse.error(code, ex.getMessage()));
    }

    /**
     * 参数校验失败（@Valid 触发）。
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException ex) {
        FieldError fieldError = ex.getBindingResult().getFieldError();
        String message = fieldError != null
                ? fieldError.getField() + ": " + fieldError.getDefaultMessage()
                : "参数校验失败";
        log.warn("参数校验失败 | msg={}", message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ErrorCode.INVALID_PARAM, message));
    }

    /**
     * 参数类型转换失败。
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String message = "参数类型不匹配: " + ex.getName();
        log.warn("参数类型不匹配 | name={} value={}", ex.getName(), ex.getValue());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ErrorCode.INVALID_PARAM, message));
    }

    /**
     * 非法参数异常。
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("非法参数 | msg={}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ErrorCode.INVALID_PARAM, ex.getMessage()));
    }

    /**
     * 静态资源未找到（404）。
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFound(NoResourceFoundException ex) {
        log.warn("资源不存在 | path={}", ex.getResourcePath());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(ErrorCode.AGENT_NOT_FOUND, "资源不存在: " + ex.getResourcePath()));
    }

    /**
     * 兜底：未知异常 → 500。
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnknownException(Exception ex, HttpServletRequest request) {
        log.error("未捕获异常 | traceId={} path={}",
                request.getRequestURI(), request.getRequestURI(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(ErrorCode.INTERNAL_ERROR, "服务内部错误"));
    }
}
