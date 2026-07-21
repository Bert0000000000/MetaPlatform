import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/App.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=0d9bf06b"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import { BrowserRouter, Routes, Route, Navigate } from "/node_modules/.vite/deps/react-router-dom.js?v=0d9bf06b";
import { ConfigProvider, App as AntApp } from "/node_modules/.vite/deps/antd.js?v=0d9bf06b";
import __vite__cjsImport5_antd_locale_zh_CN from "/node_modules/.vite/deps/antd_locale_zh_CN.js?v=0d9bf06b"; const zhCN = __vite__cjsImport5_antd_locale_zh_CN.__esModule ? __vite__cjsImport5_antd_locale_zh_CN.default : __vite__cjsImport5_antd_locale_zh_CN;
import __vite__cjsImport6_antd_locale_en_US from "/node_modules/.vite/deps/antd_locale_en_US.js?v=0d9bf06b"; const enUS = __vite__cjsImport6_antd_locale_en_US.__esModule ? __vite__cjsImport6_antd_locale_en_US.default : __vite__cjsImport6_antd_locale_en_US;
import { ErrorBoundary, useThemeMode, useAsyncError, getAntdTheme } from "/@fs/D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/packages/shared/src/index.ts";
import AppLayout from "/src/components/AppLayout.tsx";
import LoginPage from "/src/pages/LoginPage.tsx";
import ChatPage from "/src/pages/ChatPage.tsx";
import TaskOrchestrationPage from "/src/pages/TaskOrchestrationPage.tsx";
import ExecutionPlanPage from "/src/pages/ExecutionPlanPage.tsx";
import ParallelExecutionPage from "/src/pages/ParallelExecutionPage.tsx";
import ResultAggregationPage from "/src/pages/ResultAggregationPage.tsx";
import TaskTemplatePage from "/src/pages/TaskTemplatePage.tsx";
import ScheduleIntentPage from "/src/pages/ScheduleIntentPage.tsx";
import EmployeeMatchingPage from "/src/pages/EmployeeMatchingPage.tsx";
import SchedulePlanCardPage from "/src/pages/SchedulePlanCardPage.tsx";
import ScheduleExecutionPage from "/src/pages/ScheduleExecutionPage.tsx";
import ExecutionDetailPage from "/src/pages/ExecutionDetailPage.tsx";
import ResultSummaryPage from "/src/pages/ResultSummaryPage.tsx";
import ReportExportPage from "/src/pages/ReportExportPage.tsx";
import ManualSelectEmployeePage from "/src/pages/ManualSelectEmployeePage.tsx";
import A2ACollaborationPage from "/src/pages/A2ACollaborationPage.tsx";
import DataAnalysisPage from "/src/pages/DataAnalysisPage.tsx";
import { isLoggedIn } from "/src/utils/auth.ts";
function ProtectedRoute({ children }) {
  return isLoggedIn() ? /* @__PURE__ */ jsxDEV(Fragment, { children }, void 0, false, {
    fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
    lineNumber: 47,
    columnNumber: 25
  }, this) : /* @__PURE__ */ jsxDEV(Navigate, { to: "/login", replace: true }, void 0, false, {
    fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
    lineNumber: 47,
    columnNumber: 43
  }, this);
}
_c = ProtectedRoute;
function App() {
  _s();
  const { resolvedTheme, language } = useThemeMode();
  const locale = language === "en-US" ? enUS : zhCN;
  const { theme } = getAntdTheme(resolvedTheme, locale);
  useAsyncError();
  return /* @__PURE__ */ jsxDEV(ErrorBoundary, { children: /* @__PURE__ */ jsxDEV(ConfigProvider, { locale, theme, children: /* @__PURE__ */ jsxDEV(AntApp, { children: /* @__PURE__ */ jsxDEV(BrowserRouter, { children: /* @__PURE__ */ jsxDEV(Routes, { children: [
    /* @__PURE__ */ jsxDEV(Route, { path: "/login", element: /* @__PURE__ */ jsxDEV(LoginPage, {}, void 0, false, {
      fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
      lineNumber: 63,
      columnNumber: 45
    }, this) }, void 0, false, {
      fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
      lineNumber: 63,
      columnNumber: 15
    }, this),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/",
        element: /* @__PURE__ */ jsxDEV(ProtectedRoute, { children: /* @__PURE__ */ jsxDEV(AppLayout, {}, void 0, false, {
          fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
          lineNumber: 68,
          columnNumber: 21
        }, this) }, void 0, false, {
          fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
          lineNumber: 67,
          columnNumber: 17
        }, this),
        children: [
          /* @__PURE__ */ jsxDEV(Route, { index: true, element: /* @__PURE__ */ jsxDEV(Navigate, { to: "/chat", replace: true }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 72,
            columnNumber: 39
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 72,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "chat", element: /* @__PURE__ */ jsxDEV(ChatPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 73,
            columnNumber: 45
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 73,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/orchestration", element: /* @__PURE__ */ jsxDEV(TaskOrchestrationPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 74,
            columnNumber: 63
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 74,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/plan", element: /* @__PURE__ */ jsxDEV(ExecutionPlanPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 75,
            columnNumber: 54
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 75,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/parallel", element: /* @__PURE__ */ jsxDEV(ParallelExecutionPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 76,
            columnNumber: 58
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 76,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/aggregate", element: /* @__PURE__ */ jsxDEV(ResultAggregationPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 77,
            columnNumber: 59
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 77,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/templates", element: /* @__PURE__ */ jsxDEV(TaskTemplatePage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 78,
            columnNumber: 59
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 78,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/intent", element: /* @__PURE__ */ jsxDEV(ScheduleIntentPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 79,
            columnNumber: 56
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 79,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/match", element: /* @__PURE__ */ jsxDEV(EmployeeMatchingPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 80,
            columnNumber: 55
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 80,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/plan-card", element: /* @__PURE__ */ jsxDEV(SchedulePlanCardPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 81,
            columnNumber: 59
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 81,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/execution", element: /* @__PURE__ */ jsxDEV(ScheduleExecutionPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 82,
            columnNumber: 59
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 82,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/execution/detail", element: /* @__PURE__ */ jsxDEV(ExecutionDetailPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 83,
            columnNumber: 66
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 83,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/result", element: /* @__PURE__ */ jsxDEV(ResultSummaryPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 84,
            columnNumber: 56
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 84,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/export", element: /* @__PURE__ */ jsxDEV(ReportExportPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 85,
            columnNumber: 56
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 85,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/manual-select", element: /* @__PURE__ */ jsxDEV(ManualSelectEmployeePage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 86,
            columnNumber: 63
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 86,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "schedule/a2a", element: /* @__PURE__ */ jsxDEV(A2ACollaborationPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 87,
            columnNumber: 53
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 87,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Route, { path: "analysis", element: /* @__PURE__ */ jsxDEV(DataAnalysisPage, {}, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 88,
            columnNumber: 49
          }, this) }, void 0, false, {
            fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
            lineNumber: 88,
            columnNumber: 17
          }, this)
        ]
      },
      void 0,
      true,
      {
        fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
        lineNumber: 64,
        columnNumber: 15
      },
      this
    )
  ] }, void 0, true, {
    fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
    lineNumber: 62,
    columnNumber: 13
  }, this) }, void 0, false, {
    fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
    lineNumber: 61,
    columnNumber: 11
  }, this) }, void 0, false, {
    fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
    lineNumber: 60,
    columnNumber: 9
  }, this) }, void 0, false, {
    fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
    lineNumber: 59,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx",
    lineNumber: 58,
    columnNumber: 5
  }, this);
}
_s(App, "F38x+QaHuxDga5rhS9A3ZrUgB2Q=", false, function() {
  return [useThemeMode, useAsyncError];
});
_c2 = App;
export default App;
var _c, _c2;
$RefreshReg$(_c, "ProtectedRoute");
$RefreshReg$(_c2, "App");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/APP-SUPERAI/src/App.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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QUMsc0JBQUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBaUIsS0FBeEQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBNEQ7QUFBQSxVQUM1RCx1QkFBQyxTQUFNLE1BQUssMEJBQXlCLFNBQVMsdUJBQUMsOEJBQUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBeUIsS0FBdkU7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBMkU7QUFBQSxVQUMzRSx1QkFBQyxTQUFNLE1BQUssZ0JBQWUsU0FBUyx1QkFBQywwQkFBRDtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUFxQixLQUF6RDtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUE2RDtBQUFBLFVBQzdELHVCQUFDLFNBQU0sTUFBSyxZQUFXLFNBQVMsdUJBQUMsc0JBQUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBaUIsS0FBakQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBcUQ7QUFBQTtBQUFBO0FBQUEsTUF4QnZEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQXlCQTtBQUFBLE9BM0JGO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0E0QkEsS0E3QkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQThCQSxLQS9CRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBZ0NBLEtBakNGO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FrQ0EsS0FuQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQW9DQTtBQUVKO0FBQUN3QixHQTlDUTlCLEtBQUc7QUFBQSxVQUUwQkssY0FHcENDLGFBQWE7QUFBQTtBQUFBLE1BTE5OO0FBZ0RULGVBQWVBO0FBQUksSUFBQTZCLElBQUFNO0FBQUEsYUFBQU4sSUFBQTtBQUFBLGFBQUFNLEtBQUEiLCJuYW1lcyI6WyJCcm93c2VyUm91dGVyIiwiUm91dGVzIiwiUm91dGUiLCJOYXZpZ2F0ZSIsIkNvbmZpZ1Byb3ZpZGVyIiwiQXBwIiwiQW50QXBwIiwiemhDTiIsImVuVVMiLCJFcnJvckJvdW5kYXJ5IiwidXNlVGhlbWVNb2RlIiwidXNlQXN5bmNFcnJvciIsImdldEFudGRUaGVtZSIsIkFwcExheW91dCIsIkxvZ2luUGFnZSIsIkNoYXRQYWdlIiwiVGFza09yY2hlc3RyYXRpb25QYWdlIiwiRXhlY3V0aW9uUGxhblBhZ2UiLCJQYXJhbGxlbEV4ZWN1dGlvblBhZ2UiLCJSZXN1bHRBZ2dyZWdhdGlvblBhZ2UiLCJUYXNrVGVtcGxhdGVQYWdlIiwiU2NoZWR1bGVJbnRlbnRQYWdlIiwiRW1wbG95ZWVNYXRjaGluZ1BhZ2UiLCJTY2hlZHVsZVBsYW5DYXJkUGFnZSIsIlNjaGVkdWxlRXhlY3V0aW9uUGFnZSIsIkV4ZWN1dGlvbkRldGFpbFBhZ2UiLCJSZXN1bHRTdW1tYXJ5UGFnZSIsIlJlcG9ydEV4cG9ydFBhZ2UiLCJNYW51YWxTZWxlY3RFbXBsb3llZVBhZ2UiLCJBMkFDb2xsYWJvcmF0aW9uUGFnZSIsIkRhdGFBbmFseXNpc1BhZ2UiLCJpc0xvZ2dlZEluIiwiUHJvdGVjdGVkUm91dGUiLCJjaGlsZHJlbiIsIl9jIiwiX3MiLCJyZXNvbHZlZFRoZW1lIiwibGFuZ3VhZ2UiLCJsb2NhbGUiLCJ0aGVtZSIsIl9jMiJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJBcHAudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJyb3dzZXJSb3V0ZXIsIFJvdXRlcywgUm91dGUsIE5hdmlnYXRlIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XG5pbXBvcnQgeyBDb25maWdQcm92aWRlciwgQXBwIGFzIEFudEFwcCB9IGZyb20gJ2FudGQnO1xuaW1wb3J0IHpoQ04gZnJvbSAnYW50ZC9sb2NhbGUvemhfQ04nO1xuaW1wb3J0IGVuVVMgZnJvbSAnYW50ZC9sb2NhbGUvZW5fVVMnO1xuaW1wb3J0IHR5cGUgeyBSZWFjdE5vZGUgfSBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyBFcnJvckJvdW5kYXJ5LCB1c2VUaGVtZU1vZGUsIHVzZUFzeW5jRXJyb3IsIGdldEFudGRUaGVtZSB9IGZyb20gJ0BtYXRlL3NoYXJlZCc7XG5pbXBvcnQgQXBwTGF5b3V0IGZyb20gJ0AvY29tcG9uZW50cy9BcHBMYXlvdXQnO1xuaW1wb3J0IExvZ2luUGFnZSBmcm9tICdAL3BhZ2VzL0xvZ2luUGFnZSc7XG5pbXBvcnQgQ2hhdFBhZ2UgZnJvbSAnQC9wYWdlcy9DaGF0UGFnZSc7XG5pbXBvcnQgVGFza09yY2hlc3RyYXRpb25QYWdlIGZyb20gJ0AvcGFnZXMvVGFza09yY2hlc3RyYXRpb25QYWdlJztcbmltcG9ydCBFeGVjdXRpb25QbGFuUGFnZSBmcm9tICdAL3BhZ2VzL0V4ZWN1dGlvblBsYW5QYWdlJztcbmltcG9ydCBQYXJhbGxlbEV4ZWN1dGlvblBhZ2UgZnJvbSAnQC9wYWdlcy9QYXJhbGxlbEV4ZWN1dGlvblBhZ2UnO1xuaW1wb3J0IFJlc3VsdEFnZ3JlZ2F0aW9uUGFnZSBmcm9tICdAL3BhZ2VzL1Jlc3VsdEFnZ3JlZ2F0aW9uUGFnZSc7XG5pbXBvcnQgVGFza1RlbXBsYXRlUGFnZSBmcm9tICdAL3BhZ2VzL1Rhc2tUZW1wbGF0ZVBhZ2UnO1xuaW1wb3J0IFNjaGVkdWxlSW50ZW50UGFnZSBmcm9tICdAL3BhZ2VzL1NjaGVkdWxlSW50ZW50UGFnZSc7XG5pbXBvcnQgRW1wbG95ZWVNYXRjaGluZ1BhZ2UgZnJvbSAnQC9wYWdlcy9FbXBsb3llZU1hdGNoaW5nUGFnZSc7XG5pbXBvcnQgU2NoZWR1bGVQbGFuQ2FyZFBhZ2UgZnJvbSAnQC9wYWdlcy9TY2hlZHVsZVBsYW5DYXJkUGFnZSc7XG5pbXBvcnQgU2NoZWR1bGVFeGVjdXRpb25QYWdlIGZyb20gJ0AvcGFnZXMvU2NoZWR1bGVFeGVjdXRpb25QYWdlJztcbmltcG9ydCBFeGVjdXRpb25EZXRhaWxQYWdlIGZyb20gJ0AvcGFnZXMvRXhlY3V0aW9uRGV0YWlsUGFnZSc7XG5pbXBvcnQgUmVzdWx0U3VtbWFyeVBhZ2UgZnJvbSAnQC9wYWdlcy9SZXN1bHRTdW1tYXJ5UGFnZSc7XG5pbXBvcnQgUmVwb3J0RXhwb3J0UGFnZSBmcm9tICdAL3BhZ2VzL1JlcG9ydEV4cG9ydFBhZ2UnO1xuaW1wb3J0IE1hbnVhbFNlbGVjdEVtcGxveWVlUGFnZSBmcm9tICdAL3BhZ2VzL01hbnVhbFNlbGVjdEVtcGxveWVlUGFnZSc7XG5pbXBvcnQgQTJBQ29sbGFib3JhdGlvblBhZ2UgZnJvbSAnQC9wYWdlcy9BMkFDb2xsYWJvcmF0aW9uUGFnZSc7XG5pbXBvcnQgRGF0YUFuYWx5c2lzUGFnZSBmcm9tICdAL3BhZ2VzL0RhdGFBbmFseXNpc1BhZ2UnO1xuaW1wb3J0IHsgaXNMb2dnZWRJbiB9IGZyb20gJ0AvdXRpbHMvYXV0aCc7XG5cbmZ1bmN0aW9uIFByb3RlY3RlZFJvdXRlKHsgY2hpbGRyZW4gfTogeyBjaGlsZHJlbjogUmVhY3ROb2RlIH0pIHtcbiAgcmV0dXJuIGlzTG9nZ2VkSW4oKSA/IDw+e2NoaWxkcmVufTwvPiA6IDxOYXZpZ2F0ZSB0bz1cIi9sb2dpblwiIHJlcGxhY2UgLz47XG59XG5cbmZ1bmN0aW9uIEFwcCgpIHtcbiAgLy8gVjEyLTA4OiDnu5/kuIDkuLvpopjlo7Mg4oCU4oCUIOS4jiBBUFAtREFTSEJPQVJEIOWFseS6q+WQjOS4gOS7vSBsb2NhbFN0b3JhZ2Ug6K6+572u77yIbWF0ZV9wbGF0Zm9ybV9zZXR0aW5nc++8ieOAglxuICBjb25zdCB7IHJlc29sdmVkVGhlbWUsIGxhbmd1YWdlIH0gPSB1c2VUaGVtZU1vZGUoKTtcbiAgY29uc3QgbG9jYWxlID0gbGFuZ3VhZ2UgPT09ICdlbi1VUycgPyBlblVTIDogemhDTjtcbiAgY29uc3QgeyB0aGVtZSB9ID0gZ2V0QW50ZFRoZW1lKHJlc29sdmVkVGhlbWUsIGxvY2FsZSk7XG4gIHVzZUFzeW5jRXJyb3IoKTtcblxuICByZXR1cm4gKFxuICAgIDxFcnJvckJvdW5kYXJ5PlxuICAgICAgPENvbmZpZ1Byb3ZpZGVyIGxvY2FsZT17bG9jYWxlfSB0aGVtZT17dGhlbWV9PlxuICAgICAgICA8QW50QXBwPlxuICAgICAgICAgIDxCcm93c2VyUm91dGVyPlxuICAgICAgICAgICAgPFJvdXRlcz5cbiAgICAgICAgICAgICAgPFJvdXRlIHBhdGg9XCIvbG9naW5cIiBlbGVtZW50PXs8TG9naW5QYWdlIC8+fSAvPlxuICAgICAgICAgICAgICA8Um91dGVcbiAgICAgICAgICAgICAgICBwYXRoPVwiL1wiXG4gICAgICAgICAgICAgICAgZWxlbWVudD17XG4gICAgICAgICAgICAgICAgICA8UHJvdGVjdGVkUm91dGU+XG4gICAgICAgICAgICAgICAgICAgIDxBcHBMYXlvdXQgLz5cbiAgICAgICAgICAgICAgICAgIDwvUHJvdGVjdGVkUm91dGU+XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPFJvdXRlIGluZGV4IGVsZW1lbnQ9ezxOYXZpZ2F0ZSB0bz1cIi9jaGF0XCIgcmVwbGFjZSAvPn0gLz5cbiAgICAgICAgICAgICAgICA8Um91dGUgcGF0aD1cImNoYXRcIiBlbGVtZW50PXs8Q2hhdFBhZ2UgLz59IC8+XG4gICAgICAgICAgICAgICAgPFJvdXRlIHBhdGg9XCJzY2hlZHVsZS9vcmNoZXN0cmF0aW9uXCIgZWxlbWVudD17PFRhc2tPcmNoZXN0cmF0aW9uUGFnZSAvPn0gLz5cbiAgICAgICAgICAgICAgICA8Um91dGUgcGF0aD1cInNjaGVkdWxlL3BsYW5cIiBlbGVtZW50PXs8RXhlY3V0aW9uUGxhblBhZ2UgLz59IC8+XG4gICAgICAgICAgICAgICAgPFJvdXRlIHBhdGg9XCJzY2hlZHVsZS9wYXJhbGxlbFwiIGVsZW1lbnQ9ezxQYXJhbGxlbEV4ZWN1dGlvblBhZ2UgLz59IC8+XG4gICAgICAgICAgICAgICAgPFJvdXRlIHBhdGg9XCJzY2hlZHVsZS9hZ2dyZWdhdGVcIiBlbGVtZW50PXs8UmVzdWx0QWdncmVnYXRpb25QYWdlIC8+fSAvPlxuICAgICAgICAgICAgICAgIDxSb3V0ZSBwYXRoPVwic2NoZWR1bGUvdGVtcGxhdGVzXCIgZWxlbWVudD17PFRhc2tUZW1wbGF0ZVBhZ2UgLz59IC8+XG4gICAgICAgICAgICAgICAgPFJvdXRlIHBhdGg9XCJzY2hlZHVsZS9pbnRlbnRcIiBlbGVtZW50PXs8U2NoZWR1bGVJbnRlbnRQYWdlIC8+fSAvPlxuICAgICAgICAgICAgICAgIDxSb3V0ZSBwYXRoPVwic2NoZWR1bGUvbWF0Y2hcIiBlbGVtZW50PXs8RW1wbG95ZWVNYXRjaGluZ1BhZ2UgLz59IC8+XG4gICAgICAgICAgICAgICAgPFJvdXRlIHBhdGg9XCJzY2hlZHVsZS9wbGFuLWNhcmRcIiBlbGVtZW50PXs8U2NoZWR1bGVQbGFuQ2FyZFBhZ2UgLz59IC8+XG4gICAgICAgICAgICAgICAgPFJvdXRlIHBhdGg9XCJzY2hlZHVsZS9leGVjdXRpb25cIiBlbGVtZW50PXs8U2NoZWR1bGVFeGVjdXRpb25QYWdlIC8+fSAvPlxuICAgICAgICAgICAgICAgIDxSb3V0ZSBwYXRoPVwic2NoZWR1bGUvZXhlY3V0aW9uL2RldGFpbFwiIGVsZW1lbnQ9ezxFeGVjdXRpb25EZXRhaWxQYWdlIC8+fSAvPlxuICAgICAgICAgICAgICAgIDxSb3V0ZSBwYXRoPVwic2NoZWR1bGUvcmVzdWx0XCIgZWxlbWVudD17PFJlc3VsdFN1bW1hcnlQYWdlIC8+fSAvPlxuICAgICAgICAgICAgICAgIDxSb3V0ZSBwYXRoPVwic2NoZWR1bGUvZXhwb3J0XCIgZWxlbWVudD17PFJlcG9ydEV4cG9ydFBhZ2UgLz59IC8+XG4gICAgICAgICAgICAgICAgPFJvdXRlIHBhdGg9XCJzY2hlZHVsZS9tYW51YWwtc2VsZWN0XCIgZWxlbWVudD17PE1hbnVhbFNlbGVjdEVtcGxveWVlUGFnZSAvPn0gLz5cbiAgICAgICAgICAgICAgICA8Um91dGUgcGF0aD1cInNjaGVkdWxlL2EyYVwiIGVsZW1lbnQ9ezxBMkFDb2xsYWJvcmF0aW9uUGFnZSAvPn0gLz5cbiAgICAgICAgICAgICAgICA8Um91dGUgcGF0aD1cImFuYWx5c2lzXCIgZWxlbWVudD17PERhdGFBbmFseXNpc1BhZ2UgLz59IC8+XG4gICAgICAgICAgICAgIDwvUm91dGU+XG4gICAgICAgICAgICA8L1JvdXRlcz5cbiAgICAgICAgICA8L0Jyb3dzZXJSb3V0ZXI+XG4gICAgICAgIDwvQW50QXBwPlxuICAgICAgPC9Db25maWdQcm92aWRlcj5cbiAgICA8L0Vycm9yQm91bmRhcnk+XG4gICk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFwcDtcbiJdLCJmaWxlIjoiRDovSGVybWVzL1dvcmtzcGFjZS8xMF9Qcm9qZWN0cy8yMDI2LTA3LTAyLU1ldGFQbGF0Zm9ybS9BUFAtU1VQRVJBSS9zcmMvQXBwLnRzeCJ9