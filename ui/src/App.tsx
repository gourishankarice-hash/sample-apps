import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Servers } from "./pages/Servers.js";
import { Tools } from "./pages/Tools.js";
import { Resources } from "./pages/Resources.js";
import { Prompts } from "./pages/Prompts.js";
import { Logs } from "./pages/Logs.js";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="servers" element={<Servers />} />
        <Route path="tools" element={<Tools />} />
        <Route path="resources" element={<Resources />} />
        <Route path="prompts" element={<Prompts />} />
        <Route path="logs" element={<Logs />} />
      </Route>
    </Routes>
  );
}
