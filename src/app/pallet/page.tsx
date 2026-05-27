import PalletViewer from "@/components/pallet-viewer";

export const metadata = {
  title: "Pallet viewer · parcie",
};

export default function PalletPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <PalletViewer />
    </div>
  );
}
