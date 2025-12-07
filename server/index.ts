import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { waitForDatabase, isDatabaseReady } from "./db";

console.log('=== SERVER STARTUP ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || '5000');
console.log('DATABASE_URL configured:', !!process.env.DATABASE_URL);
console.log('SESSION_SECRET configured:', !!process.env.SESSION_SECRET);

const DEFAULT_ROLES = [
  { name: 'superadmin', label: 'Super Admin', description: 'Full system access with role management', isSystem: true },
  { name: 'admin', label: 'Admin', description: 'Administrative access to all pages', isSystem: true },
  { name: 'manager', label: 'Manager', description: 'Team and event management access', isSystem: true },
  { name: 'employee', label: 'Employee', description: 'Basic employee access', isSystem: true },
  { name: 'wedding_planner', label: 'Wedding Planner', description: 'Event planning and client management', isSystem: true },
  { name: 'accountant', label: 'Accountant', description: 'Financial and accounting access', isSystem: true },
];

async function ensureDefaultRoles() {
  try {
    for (const role of DEFAULT_ROLES) {
      const existing = await storage.getRoleByName(role.name);
      if (!existing) {
        await storage.createRole(role);
        console.log(`Created default role: ${role.name}`);
      }
    }
  } catch (error) {
    console.error('Error seeding default roles:', error);
  }
}

async function ensureDefaultSuperAdmin() {
  try {
    const users = await storage.getAllUsers();
    const hasSuperAdmin = users.some((u: { role: string }) => u.role === 'superadmin');
    
    if (!hasSuperAdmin) {
      const hashedPassword = await bcrypt.hash('OakAdmin2024!', 10);
      await storage.createUser({
        name: 'Super Admin',
        email: 'admin@oakstreetevent.com',
        password: hashedPassword,
        role: 'superadmin',
      });
      console.log('Created default Super Admin user (admin@oakstreetevent.com)');
      console.log('IMPORTANT: Please change the default password immediately after first login!');
    }
  } catch (error) {
    console.error('Error seeding default super admin:', error);
  }
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Health check endpoint for deployment - responds immediately
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// Redirect non-www to www in production
app.use((req, res, next) => {
  const host = req.hostname || req.headers.host || "";
  // Only redirect in production and if not already www
  if (process.env.NODE_ENV === "production" && host === "oakstreetevent.com") {
    return res.redirect(301, `https://www.oakstreetevent.com${req.originalUrl}`);
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Handle uncaught exceptions to prevent server crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

(async () => {
  try {
    // Warm up database connection with retry logic
    console.log('Warming up database connection...');
    await waitForDatabase(5);
    
    console.log('Registering routes...');
    await registerRoutes(httpServer, app);
    console.log('Routes registered successfully');

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error('Express error handler:', err);
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      console.log('Setting up static file serving for production...');
      serveStatic(app);
    } else {
      console.log('Setting up Vite for development...');
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`serving on port ${port}`);
        console.log(`Server is ready and listening on port ${port}`);
        
        // Seed default roles and superadmin in background after server starts
        // This ensures health checks pass quickly
        // Only run if database is ready
        if (isDatabaseReady) {
          (async () => {
            try {
              await ensureDefaultRoles();
              await ensureDefaultSuperAdmin();
              log('Database seeding completed');
            } catch (error) {
              console.error('Error during database seeding:', error);
            }
          })();
        } else {
          console.log('Database not ready, skipping seeding');
        }
      },
    );
  } catch (error) {
    console.error('Fatal error during server startup:', error);
    process.exit(1);
  }
})();
