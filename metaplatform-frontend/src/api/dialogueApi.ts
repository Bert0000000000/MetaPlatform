import axios from "axios";

const http = axios.create({ baseURL: "/api" });

export async function listSessions(
  userId: string = "demo",
  tenantId: string = "00000000-0000-0000-0000-000000000001",
) {
  const { data } = await http.get("/dialogue/sessions", {
    params: { userId, tenantId },
  });
  return data;
}

export async function createSession(title?: string) {
  const { data } = await http.post("/dialogue/sessions", {
    userId: "demo",
    tenantId: "00000000-0000-0000-0000-000000000001",
    title,
  });
  return data;
}

export async function getMessages(sessionId: string) {
  const { data } = await http.get(`/dialogue/sessions/${sessionId}/messages`);
  return data;
}

export async function sendMessage(sessionId: string, message: string) {
  const { data } = await http.post(`/dialogue/sessions/${sessionId}/messages`, {
    message,
  });
  return data;
}

export async function deleteSession(sessionId: string) {
  await http.delete(`/dialogue/sessions/${sessionId}`);
}
