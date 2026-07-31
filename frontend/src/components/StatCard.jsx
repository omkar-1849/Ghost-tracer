import { ArrowUpRight } from "lucide-react";

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-blue-500 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-blue-500/10">

      <div className="flex justify-between items-center">

        <div>
          <p className="text-slate-400 text-sm">
            {title}
          </p>

          <h1 className={`text-5xl font-bold mt-4 ${color}`}>
            {value}
          </h1>

          <p className="text-green-400 flex items-center gap-1 mt-4 text-sm">
            <ArrowUpRight size={16}/>
            Live
          </p>

        </div>

        <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center">
          <Icon size={28} className="text-blue-400"/>
        </div>

      </div>

    </div>
  );
}

export default StatCard;