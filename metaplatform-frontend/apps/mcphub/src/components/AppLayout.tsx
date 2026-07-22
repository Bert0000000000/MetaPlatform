import { Outlet } from 'react-router-dom';
import { AppLayout } from '@mate/shared';

export default function McphubLayout() {
  return <AppLayout module="mcphub"><Outlet /></AppLayout>;
}
