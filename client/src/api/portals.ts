import client from "./client";

export interface Portal {
  id: string;
  name: string;
  protocol: "saml" | "oidc" | "auth0" | "jwt";
  description: string;
  launchUrl: string;
  external?: boolean;
}

interface PortalsResponse {
  portals: Portal[];
}

export async function getPortals(): Promise<Portal[]> {
  const { data } = await client.get<PortalsResponse>("/portals");
  return data.portals;
}
