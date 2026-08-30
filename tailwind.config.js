/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 深色為主的錢包底色，淺色模式在 index.css 以 CSS 變數覆寫
        ink: {
          DEFAULT: '#0B0D12',
          soft: '#11141C',
        },
        panel: {
          DEFAULT: '#161A24',
          raised: '#1D2231',
        },
        line: '#262C3B',
        mist: '#8C94A8',
        chalk: '#F3F6FC',
        gold: {
          DEFAULT: '#F5C14E',
          deep: '#B98A1E',
        },
        jade: '#3DD68C',
      },
      fontFamily: {
        display: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang TC"',
          '"Noto Sans TC"',
          '"Microsoft JhengHei"',
          'sans-serif',
        ],
        body: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang TC"',
          '"Noto Sans TC"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
        num: [
          'ui-monospace',
          'SFMono-Regular',
          '"SF Mono"',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      borderRadius: {
        card: '20px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 32px -18px rgba(0,0,0,0.9)',
        crown: '0 0 0 1px rgba(245,193,78,0.45), 0 14px 40px -22px rgba(245,193,78,0.6)',
        sheet: '0 -18px 60px -20px rgba(0,0,0,0.85)',
      },
      keyframes: {
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        sheetUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseRail: {
          '0%,100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        riseIn: 'riseIn 260ms cubic-bezier(0.22,1,0.36,1) both',
        sheetUp: 'sheetUp 300ms cubic-bezier(0.22,1,0.36,1) both',
        fadeIn: 'fadeIn 200ms ease-out both',
        pulseRail: 'pulseRail 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
