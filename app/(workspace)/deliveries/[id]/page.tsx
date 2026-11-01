import { Suspense } from "react";
import { DeliveryDetailScreen } from "@/features/deliveries/delivery-detail-screen";
export const metadata = { title: "Delivery details" };
type Props = { params: Promise<{ id: string }> };
async function Delivery({ params }: Props) {
  const { id } = await params;
  return <DeliveryDetailScreen key={id} parcelId={id} />;
}
export default function Page({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="workspace-loading">Opening delivery details…</div>
      }
    >
      <Delivery params={params} />
    </Suspense>
  );
}
