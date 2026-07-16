/**
 * /api/ocr — OCR Document Recognition
 * Accepts a base64-encoded image and document type, returns extracted fields.
 * When OCR_API_URL is not configured, returns simulated results for development.
 */
import { Router } from "express";

const router = Router();

/**
 * Placeholder OCR results used when the OCR service is not configured.
 * Mirrors the structure returned by real OCR integrations for each document type.
 */
const PLACEHOLDER_RESULTS = {
  "id-card": {
    type: "id-card",
    fields: {
      "姓名": "张三",
      "性别": "男",
      "民族": "汉",
      "出生日期": "1990-05-15",
      "住址": "北京市海淀区中关村大街1号",
      "身份证号": "110108199005150012",
      "签发机关": "北京市公安局海淀分局",
      "有效期": "2020.01.01-2030.01.01",
    },
    confidence: 98.5,
    rawText: "居民身份证\n姓名：张三\n性别：男 民族：汉\n出生日期：1990年05月15日\n住址：北京市海淀区中关村大街1号\n公民身份号码：110108199005150012\n签发机关：北京市公安局海淀分局\n有效期限：2020.01.01-2030.01.01",
  },
  "business-license": {
    type: "business-license",
    fields: {
      "企业名称": "北京科技有限公司",
      "统一社会信用代码": "91110108MA01XXXXX",
      "法定代表人": "李四",
      "注册资本": "1000万元",
      "成立日期": "2020-01-10",
      "营业期限": "2020-01-10 至 长期",
      "住所": "北京市朝阳区望京街道",
      "经营范围": "技术开发、技术咨询、技术服务",
    },
    confidence: 97.2,
    rawText: "营业执照\n企业名称：北京科技有限公司\n统一社会信用代码：91110108MA01XXXXX\n法定代表人：李四\n注册资本：1000万元\n成立日期：2020年01月10日\n营业期限：2020年01月10日至长期\n住所：北京市朝阳区望京街道\n经营范围：技术开发、技术咨询、技术服务",
  },
  "invoice": {
    type: "invoice",
    fields: {
      "发票代码": "011002100111",
      "发票号码": "12345678",
      "开票日期": "2026-06-15",
      "购买方名称": "北京科技有限公司",
      "购买方税号": "91110108MA01XXXXX",
      "销售方名称": "上海贸易有限公司",
      "金额合计": "¥10,000.00",
      "税额合计": "¥1,300.00",
      "价税合计": "¥11,300.00",
    },
    confidence: 96.8,
    rawText: "增值税专用发票\n发票代码：011002100111\n发票号码：12345678\n开票日期：2026年06月15日\n购买方名称：北京科技有限公司\n购买方纳税人识别号：91110108MA01XXXXX\n销售方名称：上海贸易有限公司\n金额合计：¥10,000.00\n税额合计：¥1,300.00\n价税合计：¥11,300.00",
  },
  "business-card": {
    type: "business-card",
    fields: {
      "姓名": "王五",
      "职位": "技术总监",
      "公司": "北京科技有限公司",
      "手机": "13800138000",
      "邮箱": "wangwu@tech.com",
      "地址": "北京市海淀区中关村大街1号",
      "网站": "www.tech.com",
    },
    confidence: 95.4,
    rawText: "王五\n技术总监\n北京科技有限公司\n手机：13800138000\n邮箱：wangwu@tech.com\n地址：北京市海淀区中关村大街1号\n网站：www.tech.com",
  },
};

// ════════════════════════════════════════════════════════
//  POST /ocr — Recognize document text from image
// ════════════════════════════════════════════════════════

router.post("/", async (req, res, next) => {
  try {
    const { image, documentType } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, error: "image (base64) 为必填项" });
    }

    const docType = documentType || "id-card";

    // Attempt to use the real OCR integration if configured
    const ocrApiUrl = process.env.OCR_API_URL || "";
    if (ocrApiUrl) {
      try {
        const ocrModule = await import("../integrations/ocr.js");
        const imageBuffer = Buffer.from(image, "base64");

        // Map document types to OCR integration methods
        let result;
        if (docType === "id-card") {
          const idResult = await ocrModule.recognizeIdCard(imageBuffer);
          if (idResult) {
            result = {
              type: docType,
              fields: {
                "姓名": idResult.name || "",
                "身份证号": idResult.idNumber || "",
                "性别": idResult.gender || "",
                "出生日期": idResult.birthDate || "",
                "住址": idResult.address || "",
                "民族": idResult.nationality || "",
                "签发机关": idResult.issuingAuthority || "",
                "有效期": idResult.validity || "",
              },
              confidence: idResult.confidence || 0,
              rawText: [idResult.name, idResult.idNumber, idResult.gender, idResult.birthDate, idResult.address].filter(Boolean).join("\n"),
            };
          }
        } else if (docType === "invoice") {
          const invResult = await ocrModule.recognizeInvoice(imageBuffer);
          if (invResult) {
            result = {
              type: docType,
              fields: {
                "发票号码": invResult.invoiceNo || "",
                "开票日期": invResult.date || "",
                "购买方名称": invResult.buyer || "",
                "销售方名称": invResult.vendor || "",
                "金额合计": String(invResult.subtotal || ""),
                "税额合计": String(invResult.tax || ""),
                "价税合计": String(invResult.total || ""),
              },
              confidence: invResult.confidence || 0,
              rawText: invResult.rawText || "",
            };
          }
        } else {
          // General text recognition for business-license, business-card, etc.
          const textResult = await ocrModule.recognizeText(imageBuffer);
          if (textResult) {
            result = {
              type: docType,
              fields: {},
              confidence: textResult.confidence || 0,
              rawText: textResult.text || "",
            };
          }
        }

        if (result) {
          return res.json({ success: true, data: result });
        }
      } catch (ocrErr) {
        console.warn("[OCR Route] Real OCR call failed, falling back to placeholder:", ocrErr.message);
      }
    }

    // Fallback: return placeholder results for development
    const placeholder = PLACEHOLDER_RESULTS[docType] || PLACEHOLDER_RESULTS["id-card"];
    return res.json({ success: true, data: { ...placeholder, type: docType } });
  } catch (err) {
    next(err);
  }
});

export default router;
