import { Bell, User } from "lucide-react";



function Navbar() {
  return (
    <div className="flex items-center justify-between mb-8">

      <div>
        <h1 className="text-4xl font-bold">
          Dashboard
        </h1>

        <p className="text-slate-400 mt-2">
          Welcome back, Admin.
        </p>
      </div>

      <div className="flex items-center gap-4">

        <input
          type="text"
          placeholder="Search..."
          className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 w-72 focus:outline-none focus:border-blue-500 transition-all"
        />

        
          <button className="bg-slate-900 border border-slate-800 rounded-xl p-3 hover:bg-slate-800 transition">
              <Bell size={20}/>
          </button>

        <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center font-bold">
          <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center">
              <User size={20}/>
          </div>
        </div>

      </div>

    </div>
  );
}

export default Navbar;