import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ("serviceWorker" in navigator && import.meta.env.DEV) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
  });
  if ("caches" in window) {
    void caches.keys().then((keys) => keys.forEach((key) => void caches.delete(key)));
  }
}

createRoot(document.getElementById("root")!).render(<App />);
