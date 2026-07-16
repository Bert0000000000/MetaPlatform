/**
 * Design-time state types for the Low-Code form designer.
 */

import { DesignerField } from "./fieldLibrary";

export interface DesignerSection {
  id: string;
  title: string;
  columns: 1 | 2 | 3 | 4;
  collapsed: boolean;
  fields: DesignerField[];
}

export interface DesignerState {
  version: 1;
  pageName: string;
  pageType: "form" | "list" | "detail" | "dashboard";
  boundObjectId?: string; // primary ontology object the form binds to
  sections: DesignerSection[];
}

/** Factory: create an empty designer state with one default section */
export function createEmptyState(
  pageName = "未命名表单",
): DesignerState {
  return {
    version: 1,
    pageName,
    pageType: "form",
    sections: [
      {
        id: `sec_${Date.now().toString(36)}`,
        title: "基本信息",
        columns: 2,
        collapsed: false,
        fields: [],
      },
    ],
  };
}

/** Width → CSS grid span */
export const WIDTH_SPAN: Record<DesignerField["width"], number> = {
  full: 12,
  half: 6,
  third: 4,
  quarter: 3,
};
