import type { ReactNode } from 'react';

/** 统一表单字段样式 */
const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '0 12px',
  fontSize: 13,
  color: 'var(--foreground)',
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--foreground)',
  outline: 'none',
  resize: 'vertical',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--muted-foreground)',
  marginBottom: 6,
};

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: 16,
};

/** 字段包裹器 */
export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <div style={fieldGroupStyle}>
      <label style={labelStyle}>
        {required && <span style={{ color: 'var(--destructive)', marginRight: 4 }}>*</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

/** 文本输入 */
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" style={inputStyle} {...props} />;
}

/** 文本域 */
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea style={textareaStyle} {...props} />;
}

/** 下拉选择 */
export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select style={inputStyle} {...props}>
      {children}
    </select>
  );
}

/** 选项卡（用于多段表单的分段选择） */
export function FormSection({ title, children, desc }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {title}
      </div>
      {desc && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12, marginTop: 4 }}>{desc}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

/** 标签输入（简易） */
export function TagInput({ placeholder, value = [], onChange }: { placeholder?: string; value?: string[]; onChange?: (tags: string[]) => void }) {
  return (
    <input
      type="text"
      style={inputStyle}
      placeholder={placeholder ?? '输入后回车添加，多个用逗号分隔'}
      defaultValue={value.join(', ')}
      onChange={(e) => {
        const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
        onChange?.(tags);
      }}
    />
  );
}
