import { GiftView } from "@/components/GiftView";

export const dynamic = "force-dynamic";
export default async function GiftPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <GiftView token={token} />;
}
