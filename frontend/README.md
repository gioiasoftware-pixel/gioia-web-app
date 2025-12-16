# Frontend - Gio.ia Web App

Frontend per web app unificata.

## 🚀 Setup

```bash
npm install
cp .env.example .env
# Configurare .env
npm run dev
```

## 📁 Struttura

```
frontend/
├── src/
│   ├── components/     # Componenti riutilizzabili
│   │   ├── Viewer/     # Componente viewer
│   │   ├── Chat/       # Componente chat AI
│   │   ├── Inventory/  # Gestione inventario
│   │   └── Admin/      # Dashboard admin
│   ├── pages/          # Pagine principali
│   │   ├── Dashboard.jsx
│   │   ├── Viewer.jsx
│   │   ├── Chat.jsx
│   │   └── Admin.jsx
│   ├── services/       # API clients
│   │   ├── api.js
│   │   ├── auth.js
│   │   └── processor.js
│   ├── store/          # State management
│   ├── styles/         # CSS/SCSS
│   └── utils/          # Utility functions
├── public/
└── package.json
```

## 🎨 Stack Tecnologico

- **Framework**: React (o Vue.js) con TypeScript
- **Routing**: React Router
- **State Management**: Zustand o Redux Toolkit
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS (o CSS Modules)
- **Charts**: Chart.js

## 📝 Note

Vedi documentazione completa in `../ANALISI_WEB_APP_UNIFICATA.md`.
