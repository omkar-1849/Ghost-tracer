import {
LayoutDashboard,
ScrollText,
TriangleAlert,
ChartColumn,
Settings,
Shield
} from "lucide-react";





function Sidebar() {
  return (
    <aside className="w-72 h-screen bg-slate-900 border-r border-slate-800 flex flex-col">

      <div className="p-8 border-b border-slate-800">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-blue-500">
            <Shield size={34}/>
            Sentinel AI
        </h1>

        <p className="text-slate-400 mt-2 text-sm">
          Threat Monitoring Platform
        </p>
      </div>

      <nav className="flex-1 p-5 space-y-2">

        <button className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl bg-blue-600 transition">
            <LayoutDashboard size={20}/>
            Dashboard
        </button>

        <button className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl hover:bg-slate-800 transition">
            <ScrollText size={20}/>
            Logs
        </button>

        <button className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl hover:bg-slate-800 transition">
            <TriangleAlert size={20}/>
            Alerts
        </button>

        <button className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl hover:bg-slate-800 transition">
            <ChartColumn size={20}/>
            Analytics
        </button>

        <button className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl hover:bg-slate-800 transition">
            <Settings size={20}/>
            Settings
        </button>

      </nav>

    </aside>
  );
}

export default Sidebar;