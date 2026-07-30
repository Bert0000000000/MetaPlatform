import pathlib
p = pathlib.Path('apps/web/src/pages/knowledge/KnowledgeBasePage.tsx')
t = p.read_text(encoding='utf-8-sig')

old = """import { SubTabs, type SubTabItem, useAsync, useLoadingState } from '@mate/shared';
import { listKb, createKb, type KbEntity } from '@/api/kb';"""

new = """import { SubTabs, type SubTabItem, useCachedAsync, useLoadingState, useApiErrorBoundary } from '@mate/shared';
import { listKb, createKb, type KbEntity } from '@/api/kb';

const KB_LIST_KEY = 'kb:list';"""

assert old in t, 'imports marker missing'
t = t.replace(old, new)

old_hooks = """export default function KnowledgeBasePage() {
  const location = useLocation();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const submit = useLoadingState();
  const [reloadTick, setReloadTick] = useState(0);

  const { data: kbs, loading, error, reload } = useAsync<KbEntity[]>(
    () => listKb().catch((e: Error) => {
      message.error(`???????: ${e.message}`);
      return [];
    }),
    [reloadTick],
    { initialData: [] },
  );"""

new_hooks = """export default function KnowledgeBasePage() {
  const location = useLocation();
  const { report } = useApiErrorBoundary();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const submit = useLoadingState();
  const [reloadTick, setReloadTick] = useState(0);
  const { data: kbs, loading, error, reload, invalidate } = useCachedAsync<KbEntity[]>(
    KB_LIST_KEY,
    async () => {
      try {
        return await listKb();
      } catch (e) {
        report(e);
        return [];
      }
    },
    { onChange: reloadTick },
  );"""

assert old_hooks in t, 'hooks marker missing'
t = t.replace(old_hooks, new_hooks)

old_create = """  const onCreate = async () => {
    const values = await form.validateFields();
    await submit.wrap(createKb(values));
    setOpen(false);
    form.resetFields();
    message.success('??????');
    setReloadTick((t) => t + 1);
  };"""

new_create = """  const onCreate = async () => {
    const values = await form.validateFields();
    try {
      await submit.wrap(createKb(values));
      setOpen(false);
      form.resetFields();
      message.success('??????');
      invalidate();
      setReloadTick((t) => t + 1);
    } catch (e) {
      report(e);
    }
  };"""

assert old_create in t, 'create marker missing'
t = t.replace(old_create, new_create)

p.write_text(t, encoding='utf-8')
print('OK', len(t))
