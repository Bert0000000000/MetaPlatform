/**
 * ProcessDesignerV2Page - Page wrapper for the BPMN process designer.
 * Loads existing process definitions by ID from URL params.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ProcessDesignerV2 } from "@/components/flow-designer/ProcessDesignerV2";
import { flowableApi } from "@/lib/flowable-api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function ProcessDesignerV2Page() {
  const { definitionId } = useParams<{ definitionId?: string }>();
  const navigate = useNavigate();
  const [bpmnXml, setBpmnXml] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing process definition XML if editing
  useEffect(() => {
    if (!definitionId) return;
    setLoading(true);
    setError(null);
    flowableApi
      .getProcessXml(definitionId)
      .then((data) => {
        setBpmnXml(data.bpmn20Xml);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load process definition");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [definitionId]);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Page header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => navigate("/process")}
          title="Back to Process List"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground">
            Process Designer
            {definitionId && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                Editing: {definitionId}
              </span>
            )}
          </h1>
        </div>
      </div>

      {/* Designer content */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading process definition...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/process")}>
              Back to Process List
            </Button>
          </div>
        ) : (
          <ProcessDesignerV2
            initialBpmnXml={bpmnXml}
            definitionId={definitionId}
          />
        )}
      </div>
    </div>
  );
}
