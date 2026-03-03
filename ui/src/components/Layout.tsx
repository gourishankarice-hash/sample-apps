import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.js";

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
