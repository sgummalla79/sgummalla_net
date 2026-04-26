import axios from "axios";

export interface CopilotClient {
  client_id: string;
  name: string | null;
  allowed_origins: string[];
  created_at: string;
}

export async function listClients(): Promise<CopilotClient[]> {
  const { data } = await axios.get<CopilotClient[]>("/api/copilot/clients");
  return data;
}

export async function createClient(payload: {
  client_id: string;
  client_secret: string;
  name?: string;
  allowed_origins: string[];
}): Promise<{ ok: boolean; client_id: string }> {
  const { data } = await axios.post("/api/copilot/clients", payload);
  return data;
}

export async function updateClient(
  clientId: string,
  payload: {
    client_id?: string;
    client_secret?: string;
    name?: string;
    allowed_origins: string[];
  },
): Promise<{ client_id: string }> {
  const { data } = await axios.put(`/api/copilot/clients/${clientId}`, payload);
  return data;
}

export async function deleteClient(clientId: string): Promise<void> {
  await axios.delete(`/api/copilot/clients/${clientId}`);
}
