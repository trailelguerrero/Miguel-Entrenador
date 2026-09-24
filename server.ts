// Servidor para desarrollo local (`npm run dev`) o para correr la app fuera de
// Vercel (`npm start` con NODE_ENV=production tras `npm run build`).
// En Vercel NO se usa: allí la API la sirve api/index.ts y el frontend es estático.
import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './server/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`Uphill Coach AI server running on port ${port}`);
  });
}

startServer();
