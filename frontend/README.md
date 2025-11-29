# StockApp Frontend

A modern React frontend for the StockApp platform with a beautiful perplexity-style animated background, built with React, TypeScript, and Tailwind CSS.

## Features

- 🎨 **Modern UI/UX**: Beautiful glass-morphism design with animated backgrounds
- 🌊 **Perplexity Effect**: Stunning animated gradient backgrounds with floating orbs
- 🔐 **Authentication**: Complete login/register system with JWT token management
- 📱 **Responsive Design**: Mobile-first responsive design
- ⚡ **Fast Performance**: Built with Vite for lightning-fast development and builds
- 🎭 **Animations**: Smooth animations with Framer Motion
- 🔔 **Notifications**: Toast notifications for user feedback
- 🛡️ **Type Safety**: Full TypeScript support
- 📋 **Form Validation**: React Hook Form with Zod validation

## Tech Stack

- **React 19** - UI Library
- **TypeScript** - Type Safety
- **Vite** - Build Tool
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **React Router** - Routing
- **React Hook Form** - Form Management
- **Zod** - Schema Validation
- **Axios** - HTTP Client
- **React Hot Toast** - Notifications

## API Integration

The frontend integrates with the Django REST API backend with the following endpoints:

### Authentication Endpoints
- `POST /api/v1/auth/register/` - User registration
- `POST /api/v1/auth/login/` - User login
- `POST /api/v1/auth/logout/` - User logout
- `POST /api/v1/auth/password-reset/` - Request password reset
- `POST /api/v1/auth/password-reset-confirm/<uid>/<token>/` - Confirm password reset

### User Management Endpoints
- `GET /api/v1/users/me/` - Get current user profile
- `PUT/PATCH /api/v1/users/me/` - Update current user profile
- `POST /api/v1/users/change_password/` - Change user password

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Django backend running on `http://localhost:8080`

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
# Create .env file with:
VITE_API_URL=http://localhost:8080/api/v1
```

4. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── layout/         # Layout components
│   └── PerplexityBackground.tsx
├── contexts/           # React contexts
│   └── AuthContext.tsx
├── lib/               # Utilities and API client
│   └── api.ts
├── pages/             # Page components
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   └── Profile.tsx
├── App.tsx            # Main app component
├── main.tsx          # Entry point
└── index.css         # Global styles
```

## Features Overview

### 🎨 Perplexity-Style Background
- Animated gradient backgrounds
- Floating orbs with physics
- Glass-morphism effects
- Responsive animations

### 🔐 Authentication System
- JWT token-based authentication
- Persistent login state
- Protected routes
- Form validation with error handling

### 📱 Responsive Design
- Mobile-first approach
- Adaptive navigation
- Touch-friendly interactions
- Cross-browser compatibility

### 🎭 Smooth Animations
- Page transitions
- Hover effects
- Loading states
- Micro-interactions

## Environment Variables

```env
# API Configuration
VITE_API_URL=http://localhost:8080/api/v1

# App Configuration (optional)
VITE_APP_NAME=StockApp
VITE_APP_VERSION=1.0.0
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
