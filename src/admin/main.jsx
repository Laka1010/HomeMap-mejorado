import React from "react";
import ReactDOM from "react-dom/client";
import { AdminApp } from "./AdminApp";
import "./styles/admin-shared.css";

// Deliberadamente SIN registrar el Service Worker (a diferencia de
// src/main.jsx): Admin Console no debe tener presencia offline ni
// cache-first — siempre debe pedir la versión más fresca del panel.

ReactDOM.createRoot(document.getElementById("admin-root")).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
