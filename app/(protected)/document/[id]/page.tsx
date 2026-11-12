import { notFound } from "next/navigation";

import { DocumentDetail } from "@/components/document-detail";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const documentId = Number(id);

  if (!Number.isSafeInteger(documentId) || documentId <= 0) {
    notFound();
  }

  return <DocumentDetail documentId={documentId} />;
}
