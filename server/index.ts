import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { startReminderScheduler } from "./reminder-scheduler";

// CORS configuration for production and development
const allowedOrigins = [
  'https://app.atbottsolutions.com',
  'https://weddingsaas.onrender.com',
  'http://localhost:5000',
  'http://localhost:3000',
  'http://0.0.0.0:5000',
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    // Allow Render preview URLs
    if (origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
};

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
      const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!';
      const defaultName = process.env.DEFAULT_ADMIN_NAME || 'Super Admin';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      await storage.createUser({
        name: defaultName,
        email: defaultEmail,
        password: hashedPassword,
        role: 'superadmin',
      });
      console.log(`Created default Super Admin user (${defaultEmail})`);
      console.log('IMPORTANT: Please change the default password immediately after first login!');
    }
  } catch (error) {
    console.error('Error seeding default super admin:', error);
  }
}

const app = express();
const httpServer = createServer(app);

// Enable CORS
app.use(cors(corsOptions));

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

// Redirect non-www to www (for custom domain if configured)
app.use((req, res, next) => {
  const host = (req.hostname || req.headers.host || "").split(':')[0];
  const customDomain = process.env.CUSTOM_DOMAIN;
  if (customDomain && host === customDomain) {
    return res.redirect(301, `https://www.${customDomain}${req.originalUrl}`);
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

(async () => {
  // Seed default roles and superadmin on startup
  await ensureDefaultRoles();
  await ensureDefaultSuperAdmin();
  
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Serve the app on the port specified in the environment variable PORT
  // Default to 3000 for standard cloud deployments, 5000 for Replit
  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startReminderScheduler();
    },
  );
})();
