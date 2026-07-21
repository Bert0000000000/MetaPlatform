import { useEffect, useRef, useState } from 'react';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

interface SearchInputProps {
  /** 占位符 */
  placeholder?: string;
  /** 搜索回调（已防抖，默认 300ms） */
  onSearch?: (value: string) => void;
  /** 防抖延迟（毫秒），默认 300 */
  debounceMs?: number;
  /** 输入框宽度，默认 240 */
  width?: number | string;
  /** 是否立即在 onChange 时触发（跳过防抖），默认 false */
  immediate?: boolean;
  /** 受控 value（可选） */
  value?: string;
  /** 默认值（非受控模式） */
  defaultValue?: string;
  /** allowClear，默认 true */
  allowClear?: boolean;
}

/**
 * 统一的搜索输入框：内置防抖，避免每次按键触发请求。
 *
 * 用于替代各 APP 中重复的 `<Input.Search placeholder="搜索..." onSearch={...} />`，
 * 在用户输入时不会丢失焦点或频繁触发后端查询。
 *
 * @example
 * <SearchInput placeholder="搜索员工名称或角色" onSearch={setKeyword} />
 */
export function SearchInput({
  placeholder = '搜索...',
  onSearch,
  debounceMs = 300,
  width = 240,
  immediate = false,
  value,
  defaultValue,
  allowClear = true,
}: SearchInputProps) {
  const [inner, setInner] = useState(defaultValue ?? value ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmittedRef = useRef<string>(inner);

  useEffect(() => {
    if (value !== undefined) setInner(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const emit = (v: string) => {
    if (lastEmittedRef.current === v) return;
    lastEmittedRef.current = v;
    onSearch?.(v);
  };

  const handleChange = (v: string) => {
    setInner(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (immediate) {
      emit(v);
      return;
    }
    timerRef.current = setTimeout(() => emit(v), debounceMs);
  };

  return (
    <Input
      allowClear={allowClear}
      placeholder={placeholder}
      prefix={<SearchOutlined />}
      style={{ width }}
      value={inner}
      onChange={(e) => handleChange(e.target.value)}
      onPressEnter={(e) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        emit((e.target as HTMLInputElement).value);
      }}
    />
  );
}
