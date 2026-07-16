package com.metaplatform.ragmdm.rag;

import com.metaplatform.ragmdm.common.exception.ContentExtractionException;
import com.metaplatform.ragmdm.common.exception.UnsupportedFileTypeException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class ContentExtractor {

    /**
     * 根据文件类型提取文本内容
     */
    public String extract(String filePath, String fileType) {
        if (fileType == null) {
            throw new UnsupportedFileTypeException("null");
        }
        return switch (fileType.toLowerCase()) {
            case "txt", "text" -> extractPlainText(filePath);
            case "md", "markdown" -> extractMarkdown(filePath);
            case "pdf" -> extractPdf(filePath);
            case "docx" -> extractDocx(filePath);
            case "html", "htm" -> extractHtml(filePath);
            case "csv" -> extractPlainText(filePath);
            default -> throw new UnsupportedFileTypeException(fileType);
        };
    }

    private String extractPlainText(String filePath) {
        try {
            return Files.readString(Path.of(filePath));
        } catch (IOException e) {
            throw new ContentExtractionException("Plain text read failed: " + e.getMessage(), e);
        }
    }

    private String extractMarkdown(String filePath) {
        try {
            String mdContent = Files.readString(Path.of(filePath));
            // Strip markdown syntax to get plain text
            return mdContent
                .replaceAll("#{1,6}\\s+", "")       // headings
                .replaceAll("\\*\\*(.+?)\\*\\*", "$1") // bold
                .replaceAll("\\*(.+?)\\*", "$1")       // italic
                .replaceAll("`(.+?)`", "$1")           // inline code
                .replaceAll("```[\\s\\S]*?```", "")    // code blocks
                .replaceAll("\\[(.+?)\\]\\(.+?\\)", "$1") // links
                .replaceAll("!\\[.*?\\]\\(.+?\\)", "") // images
                .replaceAll(">\\s+", "")                // blockquotes
                .replaceAll("\\n[-*+]\\s+", "\n")      // list items
                .replaceAll("\\n\\d+\\.\\s+", "\n");    // ordered list
        } catch (IOException e) {
            throw new ContentExtractionException("Markdown read failed: " + e.getMessage(), e);
        }
    }

    private String extractPdf(String filePath) {
        try (PDDocument document = Loader.loadPDF(new File(filePath))) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        } catch (IOException e) {
            throw new ContentExtractionException("PDF extraction failed: " + e.getMessage(), e);
        }
    }

    private String extractDocx(String filePath) {
        try (XWPFDocument document = new XWPFDocument(new FileInputStream(filePath))) {
            StringBuilder sb = new StringBuilder();
            for (var paragraph : document.getParagraphs()) {
                sb.append(paragraph.getText()).append("\n");
            }
            for (XWPFTable table : document.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        sb.append(cell.getText()).append("\t");
                    }
                    sb.append("\n");
                }
            }
            return sb.toString();
        } catch (IOException e) {
            throw new ContentExtractionException("DOCX extraction failed: " + e.getMessage(), e);
        }
    }

    private String extractHtml(String filePath) {
        try {
            String html = Files.readString(Path.of(filePath));
            org.jsoup.nodes.Document doc = Jsoup.parse(html);
            doc.select("script, style, nav, header, footer").remove();
            return doc.body().text();
        } catch (IOException e) {
            throw new ContentExtractionException("HTML extraction failed: " + e.getMessage(), e);
        }
    }
}
