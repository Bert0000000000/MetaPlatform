import { Input } from '@douyinfe/semi-ui';
import { useState, useEffect, useRef } from 'react';
import { Search } from '../icons';

interface SearchInputProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  width?: number | string;
  debounce?: number;
  defaultValue?: string;
  size?: 'small' | 'default' | 'large';
}

export default function SearchInput({
  placeholder = '搜索',
  onSearch,
  width = 240,
  debounce = 300,
  defaultValue = '',
  size = 'default',
}: SearchInputProps) {
  const [value, setValue] = useState(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const triggerSearch = (next: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearch(next), debounce);
  };

  return (
    <Input
      prefix={<Search size={16} strokeWidth={1.5} />}
      placeholder={placeholder}
      value={value}
      style={{ width, borderRadius: 6, paddingLeft: 8 }}
      size={size}
      showClear
      onChange={(value: string) => {
        setValue(value);
        triggerSearch(value);
      }}
      onEnterPress={() => onSearch(value)}
    />
  );
}
