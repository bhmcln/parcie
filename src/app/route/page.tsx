import RouteViewer from "@/components/route-viewer";

export const metadata = {
  title: "Route · parcie",
};

export default function RoutePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <RouteViewer />
    </div>
  );
}
