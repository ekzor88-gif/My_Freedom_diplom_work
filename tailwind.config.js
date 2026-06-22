/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-color)",
        foreground: "var(--text-color)",
        card: "var(--card-color)",
        "card-foreground": "var(--text-color)",
        primary: "#3b82f6",
        "primary-foreground": "#ffffff",
        secondary: "#1e293b",
        "secondary-foreground": "#ffffff",
        muted: "var(--border-color)",
        "muted-foreground": "var(--text-muted)",
        accent: "#3b82f6",
        "accent-foreground": "#ffffff",
        danger: "#ef4444",
        warning: "#f59e0b",
        success: "#10b981",
        info: "#3b82f6",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
}
