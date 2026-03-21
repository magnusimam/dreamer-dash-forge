import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTelegram } from "./lib/telegram";

// Initialize Telegram WebApp SDK before React renders
initTelegram();

createRoot(document.getElementById("root")!).render(<App />);
