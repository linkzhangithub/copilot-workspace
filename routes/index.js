/**
 * 路由入口文件
 */

import express from 'express';
import aiRouter from './ai.js';

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    data: {
      message: "欢迎使用 Express API",
      version: "1.0.0",
    },
  });
});

router.use('/ai', aiRouter);

export default router;