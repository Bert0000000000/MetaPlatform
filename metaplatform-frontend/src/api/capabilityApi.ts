import axios from "axios";

const http = axios.create({ baseURL: "/api/v1" });

export async function listCapabilities(category?: string) {
  const { data } = await http.get("/capabilities", {
    params: category ? { category } : {},
  });
  return data;
}

export async function getCapability(code: string) {
  const { data } = await http.get(`/capabilities/${code}`);
  return data;
}

export async function executeCapability(
  code: string,
  input: Record<string, unknown>,
) {
  const { data } = await http.post(`/capabilities/${code}/execute`, input);
  return data;
}

export async function executePipeline(
  steps: Array<{
    capabilityCode: string;
    inputMapping: Record<string, string>;
  }>,
  initialInput: Record<string, unknown>,
) {
  const { data } = await http.post("/capabilities/pipeline", {
    steps,
    initialInput,
  });
  return data;
}
