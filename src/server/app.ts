import express, { Request, Response } from "express";
import helmet from "helmet";

export const backendApp = express();
backendApp.use(helmet());

backendApp.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});
