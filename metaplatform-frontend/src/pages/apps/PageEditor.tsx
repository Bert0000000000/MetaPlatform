import { Loader2 } from "lucide-react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { usePageEditor } from "./editors/usePageEditor";
import { EditorShell } from "./editors/EditorShell";
import { FormLowCodeEditor } from "./editors/FormLowCodeEditor";
import { ListPageEditor } from "./editors/ListPageEditor";
import { ReportEditor } from "./editors/ReportEditor";
import { FlowEditor } from "./editors/FlowEditor";
import { BIEditor } from "./editors/BIEditor";
import { TYPE_META } from "./editors/types";

export default function PageEditor() {
  const { appId } = useParams();
  const [searchParams] = useSearchParams();
  const pageId = searchParams.get("pageId");
  const navigate = useNavigate();

  const editor = usePageEditor(appId, pageId);

  const pageType = editor.pageData?.type || "lowcode";

  if (editor.loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const commonProps = {
    components: editor.components,
    setComponents: editor.setComponents,
    setDirty: editor.setDirty,
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <EditorShell
        pageName={editor.pageName}
        onPageNameChange={(name) => { editor.setPageName(name); editor.markDirty(); }}
        pageType={pageType}
        dirty={editor.dirty}
        currentVersion={editor.currentVersion}
        versions={editor.versions}
        onRestoreVersion={editor.restoreVersion}
        device={editor.device}
        onDeviceChange={editor.setDevice}
        showAI={editor.showAI}
        onToggleAI={() => editor.setShowAI(!editor.showAI)}
        saving={editor.saving}
        onSave={editor.savePage}
        onBack={() => navigate(-1)}
      >
        {renderEditorByType(pageType)}
      </EditorShell>
    </div>
  );

  function renderEditorByType(type: string) {
    switch (type) {
      case "form": case "lowcode":
        return <FormLowCodeEditor {...commonProps} selectedCompId={editor.selectedCompId} setSelectedCompId={editor.setSelectedCompId} />;
      case "list":
        return <ListPageEditor {...commonProps} />;
      case "dashboard": case "report":
        return <ReportEditor {...commonProps} />;
      case "workflow":
        return <FlowEditor {...commonProps} />;
      case "bi":
        return <BIEditor {...commonProps} />;
      default:
        return <FormLowCodeEditor {...commonProps} selectedCompId={editor.selectedCompId} setSelectedCompId={editor.setSelectedCompId} />;
    }
  }
}
