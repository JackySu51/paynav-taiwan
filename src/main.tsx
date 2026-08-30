import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// 自動更新 Service Worker：離線可用，回到線上時背景換新版
registerSW({ immediate: true });

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root 節點');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
