import express from "express";

const router = express.Router();

/**
 * 健康检查路由
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    data: { status: "ok", timestamp: new Date().toISOString() },
  });
});

export default router;
