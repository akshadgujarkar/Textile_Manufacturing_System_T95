import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/environment';
import { authRouter } from './modules/auth/auth.controller';
import { rawMaterialsRouter } from './modules/raw-materials/raw-materials.controller';
import { orderRouter } from './modules/orders/order.controller';
import { productionRouter } from './modules/production/production.controller';
import { qualityRouter } from './modules/quality/quality.controller';
import { sqlStateErrorFilter } from './middleware/sqlstate-error.filter';
import { TxManager } from './database/tx-manager';

export function createApp(): Express {
  const app = express();

  // 1. Core Security & Logging Middlewares
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // 2. Health Check & Diagnostics Route
  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      const dbResult = await TxManager.queryOne<{ server_time: string; db_name: string }>(
        'SELECT now() AS server_time, current_database() AS db_name;'
      );

      res.status(200).json({
        status: 'UP',
        system: 'Everest Textile Manufacturing System Backend',
        environment: env.NODE_ENV,
        database: {
          connected: true,
          name: dbResult?.db_name,
          serverTime: dbResult?.server_time,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(503).json({
        status: 'DOWN',
        database: { connected: false, error: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 3. Mount Modular API Routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/raw-materials', rawMaterialsRouter);
  app.use('/api/v1/orders', orderRouter);
  app.use('/api/v1/production', productionRouter);
  app.use('/api/v1/quality', qualityRouter);

  // 4. Global 404 Route Not Found Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `The requested endpoint ${req.method} ${req.path} does not exist.`,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 5. Global SQLSTATE & Application Error Filter
  app.use(sqlStateErrorFilter);

  return app;
}
