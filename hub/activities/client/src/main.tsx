import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App.tsx";
import { activityQueryClient } from "./lib/queryClient.ts";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <QueryClientProvider client={activityQueryClient}>
    <App />
  </QueryClientProvider>
);
