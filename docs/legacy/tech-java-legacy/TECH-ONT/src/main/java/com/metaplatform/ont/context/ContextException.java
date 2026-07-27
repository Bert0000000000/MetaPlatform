package com.metaplatform.ont.context;

import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.common.ErrorCode;
import org.springframework.http.HttpStatus;

public final class ContextException extends RuntimeException {
    private final HttpStatus status; private final String errorCode;
    public ContextException(String code, HttpStatus status, String message) { super(message); this.errorCode=code; this.status=status; }
    public HttpStatus getStatus(){return status;} public String getErrorCode(){return errorCode;}
    public static ContextException bad(String code,String msg){return new ContextException(code,HttpStatus.BAD_REQUEST,msg);}
    public static ContextException forbidden(String code,String msg){return new ContextException(code,HttpStatus.FORBIDDEN,msg);}
    public static ContextException notFound(String code,String msg){return new ContextException(code,HttpStatus.NOT_FOUND,msg);}
    public static ContextException gone(String code,String msg){return new ContextException(code,HttpStatus.GONE,msg);}
}
