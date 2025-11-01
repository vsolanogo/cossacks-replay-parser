import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { FPSCounter } from "./fpsCounter";
import "./index.css";
import { CanvasContainer } from "./CanvasContainer";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CanvasContainer />
    <FPSCounter />
    <App />
  </React.StrictMode>
);
