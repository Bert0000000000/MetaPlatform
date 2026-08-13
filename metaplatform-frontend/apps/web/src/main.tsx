// 必须在所有 flowgram（InversifyJS DI）之前加载 reflect-metadata polyfill，
// 否则 decorator 元数据失效导致画布 document 为空 / DI 绑定异常。
import 'reflect-metadata';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// 触发 prismjs UMD 包装器把 Prism 注册到 window（react-syntax-highlighter 的 prism 语言渲染依赖）。
import 'prismjs';
import 'prismjs/themes/prism.css';
import '../../../packages/shared/src/global.css';
import './App.css';

// Note: StrictMode disabled because @flowgram.ai/free-layout-editor v1.0.x
// uses InversifyJS DI bindings that bind on mount without unbinding, so
// double-mount under StrictMode leaves duplicate FlowRendererRegistry bindings
// and throws "Ambiguous match found for serviceIdentifier".
createRoot(document.getElementById('root')!).render(<App />);
