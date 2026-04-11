import client from "./client";

export interface Portal {
  id: string;
  name: string;
  protocol: "jwt" | "saml" | "oidc" | "auth0";
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

export async function launchExperienceCloud(): Promise<void> {
  await client.post("/portals/launch/experience-cloud");
  window.open(
    "https://experience.salesforce.com",
    "_blank",
    "noopener,noreferrer",
  );
}
