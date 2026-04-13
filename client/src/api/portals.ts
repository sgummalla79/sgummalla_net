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

interface LaunchResponse {
  frontdoorUrl: string;
}

export async function getPortals(): Promise<Portal[]> {
  const { data } = await client.get<PortalsResponse>("/portals");
  return data.portals;
}

export async function launchExperienceCloud(): Promise<void> {
  const { data } = await client.post<LaunchResponse>(
    "/portals/launch/experience-cloud",
  );
  // Server returns the frontdoor URL — redirect browser directly to it
  window.open(data.frontdoorUrl, "_blank", "noopener,noreferrer");
}
