import WebsiteLayout from "../components/websites/WebsiteLayout";

export default function Websites() {
    return (
        <div className="h-full flex flex-col animate-fade-in">
            <div className="flex-1 min-h-0 flex flex-col">
                <WebsiteLayout />
            </div>
        </div>
    );
}
