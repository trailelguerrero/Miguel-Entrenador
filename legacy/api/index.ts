// Punto de entrada serverless en Vercel: todas las rutas /api/* llegan aquí
// (ver rewrites en vercel.json) y las atiende la app Express de server/app.ts.
import app from '../server/app.js';

export default app;
