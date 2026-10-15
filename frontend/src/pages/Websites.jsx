import WebsiteLayout from "../components/websites/WebsiteLayout";

export default function Websites() {
    return (
        <div className="sentinel-page min-h-screen flex flex-col animate-fade-in select-none">
            <div className="flex-1 min-h-0 flex flex-col">
                <WebsiteLayout />
            </div>
        </div>
    );
}
