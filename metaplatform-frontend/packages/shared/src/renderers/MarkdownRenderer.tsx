import { Tag } from 'antd';
import type { CSSProperties } from 'react';

interface MarkdownRendererProps {
  content: string;
  /** dark = SuperAI 深色卡片配色；light = 浅色页面配色（默认） */
  variant?: 'dark' | 'light';
}

/**
 * 手写轻量 Markdown 渲染器（平台通用，@mate/shared）。
 *
 * 支持：标题 / 代码块 / 无序与有序列表 / 表格 / 引用 / 分割线 / 段落，
 * 行内支持加粗、斜体、行内代码、链接、删除线。
 * 提供 dark / light 两套配色：dark 用于 SuperAI 深色聊天卡片，
 * light 用于数字员工/应用/AI 面板等浅色页面。
 *
 * 说明：LLM 输出的 <think>…</think> 思维链由后端剥离，这里再做一次防御性
 * 清理（兼容修复前已落库的旧会话）。
 */
export default function MarkdownRenderer({ content, variant = 'light' }: MarkdownRendererProps) {
  const cleaned = content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/g, '');
  const palette = PALETTE[variant];
  const blocks = parseBlocks(cleaned);
  return (
    <div style={{ lineHeight: 1.7, color: palette.text }}>
      {blocks.map((block, i) => renderBlock(block, i, palette))}
    </div>
  );
}

export interface MarkdownPalette {
  text: string;
  codeBg: string;
  codeBorder: string;
  codeText: string;
  tableHeaderBg: string;
  tableBorder: string;
  tableRowAlt: string;
  quoteBorder: string;
  quoteText: string;
  link: string;
  hr: string;
  title: string;
}

const PALETTE: Record<'dark' | 'light', MarkdownPalette> = {
  dark: {
    text: '#fafafa',
    codeBg: '#1a1a1a',
    codeBorder: '#262626',
    codeText: '#fafafa',
    tableHeaderBg: '#1a1a1a',
    tableBorder: '#262626',
    tableRowAlt: '#141414',
    quoteBorder: '#404040',
    quoteText: '#a1a1a1',
    link: '#3b82f6',
    hr: '#262626',
    title: '#fafafa',
  },
  light: {
    text: '#262626',
    codeBg: '#f5f5f5',
    codeBorder: '#d9d9d9',
    codeText: '#262626',
    tableHeaderBg: '#fafafa',
    tableBorder: '#e8e8e8',
    tableRowAlt: '#fafafa',
    quoteBorder: '#d9d9d9',
    quoteText: '#737373',
    link: '#1677ff',
    hr: '#e8e8e8',
    title: '#1f1f1f',
  },
};

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'code'; lang: string; text: string }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'hr' };

function parseBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: 'code', lang, text: codeLines.join('\n') });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    if (trimmed === '---' || trimmed === '***') {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ type: 'quote', text: quoteLines.join('\n') });
      continue;
    }

    if (trimmed.match(/^[-*]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^[-*]\s+/)) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    if (trimmed.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s+/)) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const parseRow = (l: string): string[] =>
        l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const headers = parseRow(tableLines[0] ?? '');
      let dataStart = 1;
      if (tableLines[1] && /^[\s|:\-]+$/.test(tableLines[1])) {
        dataStart = 2;
      }
      const rows = tableLines
        .slice(dataStart)
        .map(parseRow)
        .filter((r) => r.some(Boolean));
      if (headers.length > 0) {
        blocks.push({ type: 'table', headers, rows });
        continue;
      }
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('> ') &&
      !lines[i].trim().match(/^[-*]\s+/) &&
      !lines[i].trim().match(/^\d+\.\s+/) &&
      lines[i].trim() !== '---' &&
      !lines[i].trim().startsWith('|')
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join('\n') });
    }
  }

  return blocks;
}

function renderBlock(block: Block, key: number, p: MarkdownPalette): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const sizes: Record<number, 1 | 2 | 3 | 4 | 5> = { 1: 3, 2: 4, 3: 5, 4: 5, 5: 5, 6: 5 };
      return (
        <TypographyTitle key={key} level={sizes[block.level] || 5} text={block.text} palette={p} />
      );
    }
    case 'code':
      return (
        <pre
          key={key}
          style={{
            background: p.codeBg,
            border: `1px solid ${p.codeBorder}`,
            padding: 12,
            borderRadius: 6,
            overflow: 'auto',
            fontSize: 13,
            color: p.codeText,
            margin: '8px 0',
          }}
        >
          {block.lang && <Tag style={{ marginBottom: 4 }}>{block.lang}</Tag>}
          <code>{block.text}</code>
        </pre>
      );
    case 'unordered-list':
      return (
        <ul key={key} style={{ paddingLeft: 20, margin: '4px 0' }}>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item, p)}</li>
          ))}
        </ul>
      );
    case 'ordered-list':
      return (
        <ol key={key} style={{ paddingLeft: 20, margin: '4px 0' }}>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item, p)}</li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div key={key} style={{ overflowX: 'auto', margin: '8px 0', border: `1px solid ${p.tableBorder}`, borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      borderBottom: `1px solid ${p.tableBorder}`,
                      borderRight: `1px solid ${p.tableBorder}`,
                      padding: '8px 12px',
                      background: p.tableHeaderBg,
                      textAlign: 'left',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {renderInline(h, p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 1 ? p.tableRowAlt : 'transparent' }}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        borderBottom: `1px solid ${p.tableBorder}`,
                        borderRight: `1px solid ${p.tableBorder}`,
                        padding: '8px 12px',
                        verticalAlign: 'top',
                      }}
                    >
                      {renderInline(cell, p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'paragraph':
      return (
        <p key={key} style={{ margin: '4px 0' }}>
          {renderInline(block.text, p)}
        </p>
      );
    case 'quote':
      return (
        <blockquote
          key={key}
          style={{
            borderLeft: `3px solid ${p.quoteBorder}`,
            paddingLeft: 12,
            margin: '8px 0',
            color: p.quoteText,
          }}
        >
          {renderInline(block.text, p)}
        </blockquote>
      );
    case 'hr':
      return <hr key={key} style={{ border: 'none', borderTop: `1px solid ${p.hr}`, margin: '12px 0' }} />;
    default:
      return null;
  }
}

function TypographyTitle({ level, text, palette }: { level: 1 | 2 | 3 | 4 | 5; text: string; palette: MarkdownPalette }) {
  const size = { 1: '1.4em', 2: '1.25em', 3: '1.1em', 4: '1em', 5: '0.95em' }[level];
  const style: CSSProperties = { fontSize: size, fontWeight: 600, margin: '12px 0 8px', color: palette.title, lineHeight: 1.4 };
  switch (level) {
    case 1:
      return <h1 style={style}>{renderInline(text, palette)}</h1>;
    case 2:
      return <h2 style={style}>{renderInline(text, palette)}</h2>;
    case 3:
      return <h3 style={style}>{renderInline(text, palette)}</h3>;
    case 4:
      return <h4 style={style}>{renderInline(text, palette)}</h4>;
    default:
      return <h5 style={style}>{renderInline(text, palette)}</h5>;
  }
}

function renderInline(text: string, p: MarkdownPalette): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/\*(.+?)\*/);
    const codeMatch = remaining.match(/`(.+?)`/);
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);
    const strikeMatch = remaining.match(/~~(.+?)~~/);

    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
      italicMatch ? { type: 'italic', match: italicMatch, index: italicMatch.index! } : null,
      codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index! } : null,
      linkMatch ? { type: 'link', match: linkMatch, index: linkMatch.index! } : null,
      strikeMatch ? { type: 'strike', match: strikeMatch, index: strikeMatch.index! } : null,
    ].filter(Boolean) as Array<{ type: string; match: RegExpMatchArray; index: number }>;

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    matches.sort((a, b) => a.index - b.index);
    const first = matches[0];

    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }

    switch (first.type) {
      case 'bold':
        parts.push(<strong key={key++}>{first.match[1]}</strong>);
        break;
      case 'italic':
        parts.push(<em key={key++}>{first.match[1]}</em>);
        break;
      case 'code':
        parts.push(
          <code
            key={key++}
            style={{ background: p.codeBg, border: `1px solid ${p.codeBorder}`, padding: '1px 6px', borderRadius: 4, fontSize: 13, color: p.codeText }}
          >
            {first.match[1]}
          </code>,
        );
        break;
      case 'link':
        parts.push(
          <a key={key++} href={first.match[2]} target="_blank" rel="noopener noreferrer" style={{ color: p.link }}>
            {first.match[1]}
          </a>,
        );
        break;
      case 'strike':
        parts.push(<del key={key++} style={{ color: p.quoteText }}>{first.match[1]}</del>);
        break;
    }

    remaining = remaining.slice(first.index + first.match[0].length);
  }

  return parts;
}
