import { Typography, Tag } from 'antd';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const blocks = parseBlocks(content);
  return (
    <div style={{ lineHeight: 1.7 }}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'code'; lang: string; text: string }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
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

    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') && !lines[i].trim().startsWith('> ') &&
      !lines[i].trim().match(/^[-*]\s+/) && !lines[i].trim().match(/^\d+\.\s+/) &&
      lines[i].trim() !== '---') {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join('\n') });
    }
  }

  return blocks;
}

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const sizes: Record<number, 1 | 2 | 3 | 4 | 5> = { 1: 3, 2: 4, 3: 5, 4: 5, 5: 5, 6: 5 };
      return (
        <Typography.Title key={key} level={sizes[block.level] || 5} style={{ marginTop: 12, marginBottom: 8 }}>
          {renderInline(block.text)}
        </Typography.Title>
      );
    }
    case 'code':
      return (
        <pre
          key={key}
          style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 6,
            overflow: 'auto',
            fontSize: 13,
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
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case 'ordered-list':
      return (
        <ol key={key} style={{ paddingLeft: 20, margin: '4px 0' }}>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case 'paragraph':
      return (
        <p key={key} style={{ margin: '4px 0' }}>
          {renderInline(block.text)}
        </p>
      );
    case 'quote':
      return (
        <blockquote
          key={key}
          style={{
            borderLeft: '4px solid #d9d9d9',
            paddingLeft: 12,
            margin: '8px 0',
            color: '#666',
          }}
        >
          {renderInline(block.text)}
        </blockquote>
      );
    case 'hr':
      return <hr key={key} style={{ border: 'none', borderTop: '1px solid #e8e8e8', margin: '12px 0' }} />;
    default:
      return null;
  }
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/\*(.+?)\*/);
    const codeMatch = remaining.match(/`(.+?)`/);
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);

    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
      italicMatch ? { type: 'italic', match: italicMatch, index: italicMatch.index! } : null,
      codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index! } : null,
      linkMatch ? { type: 'link', match: linkMatch, index: linkMatch.index! } : null,
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
          <code key={key++} style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 3, fontSize: 13 }}>
            {first.match[1]}
          </code>,
        );
        break;
      case 'link':
        parts.push(
          <a key={key++} href={first.match[2]} target="_blank" rel="noopener noreferrer">
            {first.match[1]}
          </a>,
        );
        break;
    }

    remaining = remaining.slice(first.index + first.match[0].length);
  }

  return parts;
}
