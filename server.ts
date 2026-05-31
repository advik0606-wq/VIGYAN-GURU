import app from "./api/index";
import path from "path";
import express from "express";

const PORT = 3000;

// Vite middleware for development
async function setupServer() {
  try {
    if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
      const viteKey = "vite";
      const { createServer: createViteServer } = await import(viteKey);
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else if (!process.env.VERCEL) {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } catch (error) {
    console.error("Failed to complete server setup:", error);
  }
}

setupServer().catch(err => {
  console.error("Unhandled error during setupServer startup:", err);
});

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
