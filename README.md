# Micro CRM (MERN, Microservices)

Monorepo containing:

- frontend (React + Vite + Tailwind)
- backend microservices (Node.js, Express, MongoDB) with Redis, BullMQ worker
  - gateway
  - auth-service
  - lead-service
  - notification-service
  - worker
  - shared

## Quick Start (Local, without Docker)

1. Create .env files for each service (see examples in each folder)
   - Gateway: set AUTH_SERVICE_URL, LEAD_SERVICE_URL, NOTIF_SERVICE_URL, PUBLIC_ROUTES, JWT_SECRET, FRONTEND_ORIGIN=http://localhost:5173 (dev)
   - Auth-service: set MONGO_URL, JWT_SECRET, JWT_EXPIRES_IN=15m, REFRESH_TOKEN_EXPIRES=7d, NODE_ENV=development
   - Lead-service: set MONGO_URL, NOTIF_URL, REDIS_URL (optional)
   - Notification-service: set JWT_SECRET and SMTP_* (if used)
   - Frontend: typically no VITE_API_URL needed in dev (Vite proxy used)
2. Install deps and start services in separate terminals
   - backend/gateway: npm i && npm start
   - backend/auth-service: npm i && npm start
   - backend/lead-service: npm i && npm start
   - backend/notification-service: npm i && npm start (optional)
3. Frontend (dev)
   - frontend: npm i && npm run dev
4. Open http://localhost:5173

## Services (local)

- Gateway: http://localhost:8090
- Auth Service: http://localhost:5001
- Lead Service: http://localhost:5002
- Notification Service: http://localhost:5003
- Worker: background queue processor
- MongoDB: mongodb://localhost:27017
- Redis: redis://localhost:6379

## Auth Roles

- admin, manager, sales

## Notes

- JWT auth via gateway and services
- RBAC middleware
- Redis caching for lead lists
- BullMQ for notifications
