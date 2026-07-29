import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import 'antd/dist/reset.css';
// 触发 prismjs UMD 包装器把 Prism 注册到 window；
// 否则 antd 6 的传递依赖 @ant-design/x 的 CodeHighlighter 会抛
// `Uncaught ReferenceError: Prism is not defined`。
import 'prismjs';
import 'prismjs/themes/prism.css';
import '../../../packages/shared/src/global.css';
import './App.css';

// Note: StrictMode disabled because @flowgram.ai/free-layout-editor v1.0.x
// uses InversifyJS DI bindings that bind on mount without unbinding, so
// double-mount under StrictMode leaves duplicate FlowRendererRegistry bindings
// and throws "Ambiguous match found for serviceIdentifier".
createRoot(document.getElementById('root')!).render(<App />);
