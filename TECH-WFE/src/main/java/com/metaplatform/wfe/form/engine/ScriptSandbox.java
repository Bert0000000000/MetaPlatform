package com.metaplatform.wfe.form.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.form.dto.FormValidationError;
import org.openjdk.nashorn.api.scripting.NashornScriptEngineFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.script.Bindings;
import javax.script.ScriptEngine;
import javax.script.ScriptException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

/**
 * 表单脚本沙箱（V13-13）：基于 Nashorn 引擎提供受限 JS 执行环境。
 * 只允许访问注入的 values / form / console 对象，禁止访问 Java 类。
 */
@Slf4j
@Component
public class ScriptSandbox {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final long SCRIPT_TIMEOUT_MS = 3000L;

    private final NashornScriptEngineFactory engineFactory;
    private final ExecutorService executor;

    public ScriptSandbox() {
        this.engineFactory = new NashornScriptEngineFactory();
        this.executor = Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "form-script-sandbox");
            t.setDaemon(true);
            return t;
        });
    }

    public ScriptResult execute(String script,
                                Map<String, Object> values,
                                List<Map<String, Object>> fieldOptions) {
        if (script == null || script.isBlank()) {
            return ScriptResult.empty();
        }

        ScriptContext context = new ScriptContext(values, fieldOptions);
        ScriptEngine engine = engineFactory.getScriptEngine(className -> false);
        Bindings bindings = engine.createBindings();
        bindings.put("values", context.getValuesProxy());
        bindings.put("form", context.getFormApi());
        bindings.put("console", context.getConsoleApi());

        Future<?> future = executor.submit(() -> {
            try {
                engine.eval(script, bindings);
            } catch (ScriptException e) {
                throw new WfeException(ErrorCode.FORM_SCRIPT_EXECUTION_FAILED,
                        "脚本语法错误: " + e.getMessage());
            }
            return null;
        });

        try {
            future.get(SCRIPT_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new WfeException(ErrorCode.FORM_SCRIPT_EXECUTION_FAILED, "脚本执行超时");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new WfeException(ErrorCode.FORM_SCRIPT_EXECUTION_FAILED, "脚本执行被中断");
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof WfeException wfe) {
                throw wfe;
            }
            throw new WfeException(ErrorCode.FORM_SCRIPT_EXECUTION_FAILED,
                    "脚本执行失败: " + (cause != null ? cause.getMessage() : e.getMessage()));
        }

        return context.toResult();
    }

    /**
     * 仅校验脚本语法与可执行性，不保留副作用。
     */
    public List<FormValidationError> validate(String script, Map<String, Object> sampleValues) {
        List<FormValidationError> errors = new ArrayList<>();
        if (script == null || script.isBlank()) {
            return errors;
        }
        try {
            execute(script, sampleValues != null ? sampleValues : Map.of(), List.of());
        } catch (WfeException e) {
            errors.add(FormValidationError.builder()
                    .fieldKey("script")
                    .code("SCRIPT_ERROR")
                    .message(e.getMessage())
                    .build());
        }
        return errors;
    }

    public static class ScriptResult {

        private final Map<String, Object> fieldVisible;
        private final Map<String, Object> fieldRequired;
        private final Map<String, Object> fieldReadonly;
        private final Map<String, Object> fieldValue;
        private final Map<String, List<Map<String, Object>>> fieldOptions;
        private final List<FormValidationError> errors;

        public ScriptResult() {
            this.fieldVisible = new HashMap<>();
            this.fieldRequired = new HashMap<>();
            this.fieldReadonly = new HashMap<>();
            this.fieldValue = new HashMap<>();
            this.fieldOptions = new HashMap<>();
            this.errors = new ArrayList<>();
        }

        public static ScriptResult empty() {
            return new ScriptResult();
        }

        public Map<String, Object> getFieldVisible() { return fieldVisible; }
        public Map<String, Object> getFieldRequired() { return fieldRequired; }
        public Map<String, Object> getFieldReadonly() { return fieldReadonly; }
        public Map<String, Object> getFieldValue() { return fieldValue; }
        public Map<String, List<Map<String, Object>>> getFieldOptions() { return fieldOptions; }
        public List<FormValidationError> getErrors() { return errors; }
    }

    /**
     * 脚本执行上下文：封装受控的 values / form / console 对象。
     */
    private static class ScriptContext {

        private final Map<String, Object> values;
        private final List<Map<String, Object>> fieldOptions;
        private final ScriptResult result = new ScriptResult();

        ScriptContext(Map<String, Object> values, List<Map<String, Object>> fieldOptions) {
            this.values = new HashMap<>(values != null ? values : Map.of());
            this.fieldOptions = fieldOptions != null ? fieldOptions : List.of();
        }

        Object getValuesProxy() {
            return new ValuesProxy(values);
        }

        Object getFormApi() {
            return new FormApi(result);
        }

        Object getConsoleApi() {
            return new ConsoleApi();
        }

        ScriptResult toResult() {
            return result;
        }
    }

    /**
     * values 代理：支持读写 values.fieldKey。
     */
    @SuppressWarnings("unused")
    public static class ValuesProxy {

        private final Map<String, Object> values;

        public ValuesProxy(Map<String, Object> values) {
            this.values = values;
        }

        public Object get(String key) {
            return values.get(key);
        }

        public void set(String key, Object value) {
            values.put(key, value);
        }
    }

    /**
     * form API 代理：只暴露表单操作能力，禁止访问其它 Java 对象。
     */
    @SuppressWarnings("unused")
    public static class FormApi {

        private final ScriptResult result;

        public FormApi(ScriptResult result) {
            this.result = result;
        }

        public void setFieldVisible(String fieldKey, boolean visible) {
            result.fieldVisible.put(fieldKey, visible);
        }

        public void setFieldRequired(String fieldKey, boolean required) {
            result.fieldRequired.put(fieldKey, required);
        }

        public void setFieldReadonly(String fieldKey, boolean readonly) {
            result.fieldReadonly.put(fieldKey, readonly);
        }

        public void setFieldValue(String fieldKey, Object value) {
            result.fieldValue.put(fieldKey, value);
        }

        @SuppressWarnings("unchecked")
        public void setFieldOptions(String fieldKey, Object options) {
            if (options instanceof List) {
                result.fieldOptions.put(fieldKey, (List<Map<String, Object>>) options);
            } else if (options instanceof String json) {
                try {
                    result.fieldOptions.put(fieldKey, OBJECT_MAPPER.readValue(json, List.class));
                } catch (Exception e) {
                    throw new IllegalArgumentException("选项必须是 JSON 数组: " + e.getMessage());
                }
            }
        }

        public void addError(String fieldKey, String message) {
            result.errors.add(FormValidationError.builder()
                    .fieldKey(fieldKey)
                    .code("SCRIPT_VALIDATION")
                    .message(message)
                    .build());
        }
    }

    @SuppressWarnings("unused")
    public static class ConsoleApi {

        public void log(Object msg) {
            log.debug("[form-script] {}", msg);
        }
    }
}
