import { get, put, post } from './client';
import type {
  FormDefinitionResponse,
  FormGlobalSettings,
  LinkageRule,
  FormScripts,
  FormValidateResponse,
  FormField,
} from '@/types';

export async function getFormDefinition(formId: string): Promise<FormDefinitionResponse> {
  try {
    return await get<FormDefinitionResponse>(`/v1/wfe/forms/${formId}`, undefined, true);
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 404) {
      return {
        formId,
        globalSettings: { title: '' } as FormGlobalSettings,
        linkageRules: [],
        scripts: {},
      };
    }
    throw error;
  }
}

export async function saveFormSettings(
  formId: string,
  settings: FormGlobalSettings
): Promise<FormDefinitionResponse> {
  return put<FormDefinitionResponse>(`/v1/wfe/forms/${formId}/settings`, settings);
}

export async function saveFormLinkageRules(
  formId: string,
  rules: LinkageRule[]
): Promise<FormDefinitionResponse> {
  return put<FormDefinitionResponse>(`/v1/wfe/forms/${formId}/linkage-rules`, { rules });
}

export async function saveFormScripts(
  formId: string,
  scripts: FormScripts
): Promise<FormDefinitionResponse> {
  return put<FormDefinitionResponse>(`/v1/wfe/forms/${formId}/scripts`, scripts);
}

export interface ValidateFormRequest {
  fields: FormField[];
  globalSettings?: FormGlobalSettings;
  linkageRules?: LinkageRule[];
  scripts?: FormScripts;
  values?: Record<string, unknown>;
}

export async function validateForm(
  formId: string,
  request: ValidateFormRequest
): Promise<FormValidateResponse> {
  return post<FormValidateResponse>(`/v1/wfe/forms/${formId}/validate`, request);
}
