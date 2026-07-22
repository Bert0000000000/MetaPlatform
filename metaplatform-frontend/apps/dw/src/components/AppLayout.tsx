import { Outlet } from 'react-router-dom';
import { AppLayout } from '@mate/shared';

export default function DwLayout() {
  return <AppLayout module="dw"><Outlet /></AppLayout>;
}
