import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { Storage } from "./storage/storage";
import { handleCheck, handleRecord } from "./handlers";

export const createApp = (storage: Storage) => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/v1/check", async (req, res) => {
    const result = await handleCheck(storage, req.body);
    return res.status(result.status).json(result.body);
  });

  app.post("/v1/record", async (req, res) => {
    const result = await handleRecord(storage, req.body);
    return res.status(result.status).json(result.body);
  });

  return app;
};
