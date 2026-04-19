import { AssetProfileClient } from './asset-profile-client';

export default async function AssetProfilePage({
  params,
}: {
  params: Promise<{ carNumber: string }>;
}) {
  const { carNumber } = await params;
  return <AssetProfileClient carNumber={decodeURIComponent(carNumber)} />;
}
