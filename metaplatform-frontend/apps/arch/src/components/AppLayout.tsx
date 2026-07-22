import { Outlet } from 'react-router-dom';
import { AppLayout } from '@mate/shared';

export default function ArchLayout() {
  return <AppLayout module="arch"><Outlet /></AppLayout>;
}
