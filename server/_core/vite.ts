import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { logger } from '../core/logger/index';

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // En mode développement compilé, utiliser le fichier index.html du build
      // ✅ FIX: Utiliser process.cwd() pour résoudre le chemin depuis la racine du projet
      const clientTemplate = process.env['NODE_ENV'] === "production" 
        ? path.resolve(import.meta.dirname, "public", "index.html")
        : path.resolve(process.cwd(), "client", "index.html");

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      ).replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      ); // Double check for different quote styles if needed
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // En production, le fichier compilé est dans dist/, donc public est à côté
  // Si on lance depuis la racine avec node dist/index.js, import.meta.dirname est dist/
  const distPath = path.resolve(process.cwd(), "dist", "public");
  logger.info(`[Static] Serving files from: ${distPath}`);
  
  if (!fs.existsSync(distPath)) {
    logger.error(
      `[ERREUR CRITIQUE] Build directory not found: ${distPath}`
    );
    logger.error(`[SOLUTION] Exécutez 'pnpm run build' avant de démarrer en production`);
  }

  // Servir les fichiers statiques avec cache pour les assets
  app.use(express.static(distPath, {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Cache agressif pour les assets avec hash
      if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));

  // SPA fallback: retourner index.html pour toutes les routes non-API
  app.get("*", (req, res, next) => {
    // Ne pas intercepter les routes API, metrics, health
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/metrics') || 
        req.path.startsWith('/health')) {
      return next();
    }
    
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      // Pas de cache pour index.html (pour les mises à jour)
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(indexPath);
    } else {
      res.status(503).send(`
        <html>
          <head><title>Service Unavailable</title></head>
          <body style="font-family: Arial; padding: 50px; text-align: center;">
            <h1>⚠️ Service Unavailable</h1>
            <p>L'application n'est pas encore compilée.</p>
            <p><strong>Solution:</strong> Exécutez <code>pnpm run build</code></p>
            <hr>
            <small>Build path: ${indexPath}</small>
          </body>
        </html>
      `);
    }
  });
}
