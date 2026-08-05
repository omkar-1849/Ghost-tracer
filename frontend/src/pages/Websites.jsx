import WebsiteLayout from "../components/websites/WebsiteLayout";

export default function Websites() {
    return (
        <div className="h-full flex flex-col animate-fade-in relative">
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
            <div className="absolute top-1/4 left-1/2 w-[30%] h-[30%] rounded-full bg-cyan-900/5 blur-[120px] pointer-events-none" />

            <div className="flex-1 min-h-0 flex flex-col relative z-10">
                <WebsiteLayout />
            </div>
        </div>
    );
}
