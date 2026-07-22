import { Input } from 'antd';
import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  width?: number | string;
  debounce?: number;
  defaultValue?: string;
}

export default function SearchInput({
  placeholder = '搜索',
  onSearch,
  width = 240,
  debounce = 300,
  defaultValue = '',
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
      className="v-input"
      prefix={<Search size={16} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />}
      placeholder={placeholder}
      value={value}
      style={{ width }}
      onChange={(e) => {
        setValue(e.target.value);
        triggerSearch(e.target.value);
      }}
      onPressEnter={() => onSearch(value)}
    />
  );
}
