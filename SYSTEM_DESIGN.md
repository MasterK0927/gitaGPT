# GitaGPT - High-Level Design & System Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Technology Stack](#technology-stack)
6. [Database Design](#database-design)
7. [API Design](#api-design)
8. [Security Architecture](#security-architecture)
9. [Deployment Architecture](#deployment-architecture)
10. [Performance & Scalability](#performance--scalability)

## System Overview

GitaGPT is an AI-powered spiritual advisor application that provides personalized guidance based on the Bhagavad Gita. The system combines modern web technologies with AI services to deliver an interactive chat experience with text-to-speech capabilities, meditation features, and comprehensive user management.

### Key Features
- **AI-Powered Chat**: Context-aware conversations using OpenAI GPT with Gemini fallback
- **Text-to-Speech**: Multi-provider TTS (OpenAI, ElevenLabs, Gemini) with audio generation
- **Authentication**: Clerk-based authentication with custom UI components
- **Meditation System**: Scheduled meditation sessions with progress tracking
- **Real-time Analytics**: User statistics and system health monitoring
- **Responsive Design**: Mobile-first UI with modern React components

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  React Frontend (Vite + TypeScript)                            │
│  ├── Authentication (Clerk)                                    │
│  ├── Chat Interface (Real-time)                               │
│  ├── Meditation Dashboard                                      │
│  ├── Analytics & Monitoring                                   │
│  └── User Management                                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PROXY LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Nginx Reverse Proxy                                          │
│  ├── Rate Limiting                                            │
│  ├── SSL Termination                                          │
│  ├── Static Asset Serving                                     │
│  ├── API Routing                                              │
│  └── Security Headers                                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Node.js Backend (Express)                                    │
│  ├── Authentication Middleware                                │
│  ├── Chat Controller                                          │
│  ├── User Management                                          │
│  ├── Meditation Services                                      │
│  ├── Health Monitoring                                        │
│  └── Webhook Handlers                                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  AI Services          │  Audio Services    │  Infrastructure   │
│  ├── OpenAI GPT      │  ├── OpenAI TTS   │  ├── Redis Cache  │
│  ├── Gemini AI       │  ├── ElevenLabs   │  ├── Message Queue│
│  └── Fallback Chat   │  └── Audio Proc.  │  └── Cron Jobs    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Supabase PostgreSQL                                          │
│  ├── Users & Authentication                                   │
│  ├── Conversations & Messages                                 │
│  ├── Meditation Sessions                                      │
│  ├── System Logs                                              │
│  └── Analytics Data                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Architecture (React + TypeScript)

```
src/
├── components/           # Reusable UI components
│   ├── auth/            # Authentication components
│   ├── dashboard/       # Dashboard-specific components
│   ├── system/          # System monitoring components
│   └── ErrorBoundary.tsx
├── features/            # Feature-based modules
│   ├── auth/           # Authentication feature
│   │   ├── components/
│   │   ├── hooks/
│   │   └── stores/
│   ├── chat/           # Chat feature
│   │   ├── components/
│   │   ├── stores/
│   │   └── services/
│   ├── meditation/     # Meditation feature
│   └── user/          # User management
├── hooks/              # Custom React hooks
├── layouts/            # Layout components
├── pages/              # Page components
├── providers/          # Context providers
├── services/           # API services
├── shared/             # Shared utilities
│   ├── components/
│   ├── constants/
│   ├── types/
│   └── utils/
└── lib/               # Third-party integrations
```

### Backend Architecture (Node.js + Express)

```
src/
├── app.js              # Application entry point
├── config/             # Configuration management
├── controllers/        # Request handlers
│   ├── ChatController.js
│   ├── UserController.js
│   ├── MeditationController.js
│   └── GitaController.js
├── middleware/         # Express middleware
│   ├── auth.js
│   ├── security.js
│   └── errorHandler.js
├── routes/             # API route definitions
├── services/           # Business logic services
│   ├── OpenAIService.js
│   ├── GeminiService.js
│   ├── ElevenLabsService.js
│   ├── TTSService.js
│   ├── database.js
│   ├── cache.js
│   ├── messageQueue.js
│   └── logger.js
├── utils/              # Utility functions
└── data/              # Static data (Gita quotes)
```

## Data Flow

### Chat Message Flow

1. **User Input**: User types message in React chat interface
2. **Authentication**: Clerk validates user session and provides JWT token
3. **API Request**: Frontend sends POST to `/api/v1/chat` with message and token
4. **Middleware**: Backend validates token, syncs user data, applies rate limiting
5. **Context Loading**: System loads conversation context from cache/database
6. **AI Processing**: 
   - Primary: OpenAI GPT generates response with context
   - Fallback: Gemini AI if OpenAI fails
   - Emergency: Static fallback responses
7. **Audio Generation**: TTS service generates speech audio (OpenAI → ElevenLabs → fallback)
8. **Response Storage**: Message and response stored in database and cached
9. **Real-time Update**: Response sent to frontend with audio data
10. **UI Update**: Chat interface displays message with audio playback option

### Authentication Flow

1. **User Registration/Login**: Clerk handles authentication UI and validation
2. **Token Generation**: Clerk generates JWT token for authenticated user
3. **User Sync**: Backend syncs Clerk user data with internal database
4. **Session Management**: Frontend stores auth state, backend validates on each request
5. **Auto-refresh**: Clerk automatically refreshes tokens before expiration

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 7.0
- **Styling**: Tailwind CSS with custom components
- **State Management**: Zustand with persistence
- **Authentication**: Clerk React SDK
- **UI Components**: Radix UI primitives
- **Animations**: Framer Motion
- **HTTP Client**: Axios with interceptors

### Backend
- **Runtime**: Node.js 18+ with ES modules
- **Framework**: Express.js with middleware
- **Authentication**: Clerk Node SDK
- **Database**: Supabase (PostgreSQL)
- **Caching**: Redis with connection pooling
- **Logging**: Winston with daily rotation
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting

### AI & Audio Services
- **Primary AI**: OpenAI GPT-4 with JSON mode
- **Fallback AI**: Google Gemini 2.0 Flash
- **Primary TTS**: OpenAI TTS-1 with voice selection
- **Fallback TTS**: ElevenLabs with voice cloning
- **Audio Processing**: Buffer management and streaming

### Infrastructure
- **Frontend Hosting**: Google Cloud Run (containerized)
- **Backend Hosting**: Google Cloud Run (containerized)
- **Reverse Proxy**: Nginx with optimization
- **Database**: Supabase managed PostgreSQL
- **Caching**: Redis (managed or self-hosted)
- **Monitoring**: Custom health checks and metrics

## Database Design

### Core Tables

```sql
-- Users table (synced with Clerk)
users (
  id: UUID PRIMARY KEY,
  clerk_id: VARCHAR UNIQUE NOT NULL,
  email: VARCHAR UNIQUE NOT NULL,
  name: VARCHAR,
  username: VARCHAR UNIQUE,
  avatar_url: TEXT,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  deleted_at: TIMESTAMP -- Soft delete
)

-- Conversations
conversations (
  id: UUID PRIMARY KEY,
  user_id: UUID REFERENCES users(id),
  title: VARCHAR,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  deleted_at: TIMESTAMP
)

-- User messages
user_messages (
  id: UUID PRIMARY KEY,
  conversation_id: UUID REFERENCES conversations(id),
  content: TEXT NOT NULL,
  created_at: TIMESTAMP
)

-- AI responses
ai_responses (
  id: UUID PRIMARY KEY,
  user_message_id: UUID REFERENCES user_messages(id),
  content: TEXT NOT NULL,
  audio_url: TEXT,
  lipsync_data: JSONB,
  facial_expression: VARCHAR,
  animation: VARCHAR,
  processing_mode: VARCHAR,
  response_order: INTEGER,
  created_at: TIMESTAMP
)

-- Meditation sessions
meditation_sessions (
  id: UUID PRIMARY KEY,
  user_id: UUID REFERENCES users(id),
  title: VARCHAR NOT NULL,
  duration_minutes: INTEGER NOT NULL,
  meditation_type: VARCHAR NOT NULL,
  mood_before: VARCHAR,
  mood_after: VARCHAR,
  notes: TEXT,
  completed_at: TIMESTAMP,
  created_at: TIMESTAMP
)

-- Meditation schedules
meditation_schedules (
  id: UUID PRIMARY KEY,
  user_id: UUID REFERENCES users(id),
  title: VARCHAR NOT NULL,
  duration_minutes: INTEGER NOT NULL,
  meditation_type: VARCHAR NOT NULL,
  scheduled_time: TIME NOT NULL,
  days_of_week: INTEGER[] NOT NULL,
  is_active: BOOLEAN DEFAULT true,
  created_at: TIMESTAMP
)
```

### Indexes and Performance

```sql
-- Performance indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_user_messages_conversation_id ON user_messages(conversation_id);
CREATE INDEX idx_ai_responses_user_message_id ON ai_responses(user_message_id);
CREATE INDEX idx_meditation_sessions_user_id ON meditation_sessions(user_id);
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);
```

## API Design

### RESTful API Structure

```
Base URL: https://gitagpt-backend-*.run.app/api/v1

Authentication: Bearer JWT (Clerk token)
Content-Type: application/json
```

#### Core Endpoints

**Authentication & User Management**
```
POST   /auth/sync-user          # Sync Clerk user to database
GET    /auth/check-username     # Check username availability
GET    /user/profile            # Get user profile
PUT    /user/profile            # Update user profile
GET    /user/stats              # Get user statistics
POST   /user/delete-account     # Request account deletion
POST   /user/restore-account    # Restore deleted account
```

**Chat System**
```
POST   /chat                    # Send chat message
GET    /chat/conversations      # Get user conversations
GET    /chat/conversations/:id/messages    # Get conversation messages
GET    /chat/conversations/:id/details     # Get conversation details
POST   /chat/conversations      # Create new conversation
DELETE /chat/conversations/:id  # Delete conversation (soft)
```

**Meditation System**
```
GET    /meditation/sessions     # Get meditation sessions
POST   /meditation/sessions     # Start new session
PUT    /meditation/sessions/:id # Complete session
GET    /meditation/schedules    # Get meditation schedules
POST   /meditation/schedules    # Create schedule
PUT    /meditation/schedules/:id # Update schedule
DELETE /meditation/schedules/:id # Delete schedule
GET    /meditation/types        # Get meditation types
GET    /meditation/sounds       # Get meditation sounds
GET    /meditation/stats        # Get meditation statistics
```

**Gita Content**
```
GET    /gita/quotes            # Get Gita quotes
GET    /gita/quotes/random     # Get random quote
GET    /gita/quotes/search     # Search quotes
GET    /gita/categories        # Get quote categories
GET    /gita/tags              # Get available tags
```

**System Health**
```
GET    /health                 # Comprehensive health check
GET    /health/database        # Database health
GET    /health/cache           # Cache health
GET    /health/ai-services     # AI services health
GET    /health/queue           # Message queue health
```

#### Response Format

**Success Response**
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional success message",
  "requestId": "unique-request-id",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error Response**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  },
  "requestId": "unique-request-id",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Security Architecture

### Authentication & Authorization

1. **Clerk Integration**
   - JWT-based authentication
   - Automatic token refresh
   - Session management
   - Multi-factor authentication support

2. **Backend Validation**
   - JWT signature verification
   - Token expiration checks
   - User session validation
   - Rate limiting per user

3. **API Security**
   - CORS configuration
   - Request size limits
   - Input validation and sanitization
   - SQL injection prevention

### Security Headers

```nginx
# Nginx security headers
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Rate Limiting

```
General API: 30 requests/second
Chat API: 10 requests/second
Auth API: 5 requests/minute
Connection limit: 20 per IP
```

### Data Protection

1. **Encryption**
   - HTTPS/TLS 1.3 for all communications
   - Database encryption at rest
   - Sensitive data hashing

2. **Privacy**
   - Soft delete for user data
   - 30-day restoration period
   - GDPR compliance features
   - Data anonymization options

## Deployment Architecture

### Container Strategy

**Frontend Container (Nginx + React)**
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
# Build React app
FROM nginx:1.25-alpine AS production
# Serve static files + proxy API calls
```

**Backend Container (Node.js)**
```dockerfile
# Security-hardened container
FROM node:18-alpine AS base
# Non-root user execution
# Minimal attack surface
```

### Cloud Infrastructure

**Google Cloud Run Deployment**
```yaml
Frontend Service:
  - URL: https://gitagpt-*.asia-south2.run.app
  - Auto-scaling: 0-100 instances
  - Memory: 512MB
  - CPU: 1 vCPU

Backend Service:
  - URL: https://gitagpt-backend-*.asia-south2.run.app
  - Auto-scaling: 0-10 instances
  - Memory: 1GB
  - CPU: 1 vCPU
```

**External Services**
- **Database**: Supabase PostgreSQL (managed)
- **Authentication**: Clerk (SaaS)
- **AI Services**: OpenAI API, Google Gemini API
- **TTS Services**: OpenAI TTS, ElevenLabs API
- **Caching**: Redis (managed or self-hosted)

### Environment Configuration

```bash
# Backend Environment Variables
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
CLERK_SECRET_KEY=...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://...
```

## Performance & Scalability

### Caching Strategy

1. **Frontend Caching**
   - Browser cache for static assets (1 year)
   - Service worker for offline support
   - Local storage for user preferences
   - Memory cache for API responses

2. **Backend Caching**
   - Redis for conversation context (2 hours)
   - API response caching (5-30 minutes)
   - Database query result caching
   - Static data caching (Gita quotes)

3. **CDN & Edge Caching**
   - Nginx static asset caching
   - Gzip compression
   - HTTP/2 support
   - Edge location optimization

### Performance Optimizations

**Frontend**
- Code splitting and lazy loading
- Image optimization and WebP support
- Bundle size optimization
- Tree shaking and dead code elimination
- Preloading critical resources

**Backend**
- Connection pooling for database
- Async/await for non-blocking operations
- Request/response compression
- Database query optimization
- Background job processing

**Database**
- Proper indexing strategy
- Query optimization
- Connection pooling
- Read replicas for scaling
- Automated backups

### Monitoring & Observability

1. **Health Checks**
   - Application health endpoints
   - Database connectivity checks
   - External service availability
   - Resource utilization monitoring

2. **Logging**
   - Structured logging with Winston
   - Request/response logging
   - Error tracking and alerting
   - Performance metrics collection

3. **Analytics**
   - User engagement metrics
   - API usage statistics
   - Error rate monitoring
   - Response time tracking

### Scalability Considerations

**Horizontal Scaling**
- Stateless application design
- Load balancer ready
- Database connection pooling
- Shared cache layer

**Vertical Scaling**
- Memory optimization
- CPU usage optimization
- Database performance tuning
- Cache hit ratio optimization

**Auto-scaling Triggers**
- CPU utilization > 70%
- Memory usage > 80%
- Request queue depth > 100
- Response time > 2 seconds

---

## Conclusion

GitaGPT represents a modern, scalable architecture that combines AI-powered conversations with spiritual guidance. The system is designed for high availability, security, and user experience, with comprehensive monitoring and observability features.

The modular architecture allows for easy maintenance and feature additions, while the containerized deployment strategy ensures consistent environments across development, staging, and production.

Key strengths:
- **Resilient AI Pipeline**: Multiple AI providers with intelligent fallback
- **Secure Authentication**: Clerk integration with custom UI
- **Performance Optimized**: Multi-layer caching and optimization
- **Scalable Infrastructure**: Cloud-native deployment with auto-scaling
- **Comprehensive Monitoring**: Health checks and real-time metrics
```
