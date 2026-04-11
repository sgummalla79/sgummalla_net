import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  signToken,
  cookieOptions,
  getCookieName,
  type AuthUser,
} from "../lib/jwt.js";

const router: import("express").Router = Router();

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;
let authMiddleware: AuthMiddleware | null = null;

async function getAuthMiddleware(): Promise<AuthMiddleware> {
  if (authMiddleware) return authMiddleware;

  const { auth } = await import("express-openid-connect");

  authMiddleware = auth({
    authorizationParams: {
      response_type: "code",
      scope: "openid profile email",
    },
    authRequired: false,
    baseURL: process.env.CLIENT_URL ?? "http://localhost:5173",
    clientID: process.env.AUTH0_CLIENT_ID ?? "",
    clientSecret: process.env.AUTH0_CLIENT_SECRET ?? "",
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN ?? ""}`,
    secret: process.env.JWT_SECRET ?? "",
    routes: {
      login: false,
      callback: false,
      logout: false,
    },
  });

  return authMiddleware;
}

router.get(
  "/initiate",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const middleware = await getAuthMiddleware();
      middleware(req, res, () => {
        res.oidc.login({
          returnTo: `${process.env.CLIENT_URL ?? "http://localhost:5173"}/home`,
        });
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/callback",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const middleware = await getAuthMiddleware();
      middleware(req, res, () => {
        const oidcUser = req.oidc?.user;

        if (!oidcUser) {
          res.redirect(
            `${process.env.CLIENT_URL ?? "http://localhost:5173"}/login?error=auth0_failed`,
          );
          return;
        }

        const user: AuthUser = {
          id: oidcUser.sub as string,
          email: (oidcUser.email as string) ?? "",
          name: (oidcUser.name as string) ?? (oidcUser.email as string) ?? "",
          provider: "auth0",
        };

        const token = signToken(user);
        res.cookie(getCookieName(), token, cookieOptions());
        res.redirect(
          `${process.env.CLIENT_URL ?? "http://localhost:5173"}/home`,
        );
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
