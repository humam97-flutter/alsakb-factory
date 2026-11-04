import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { MaterialForm } from "../material-form";

export default async function NewMaterialPage({ searchParams }: PageProps) {
  await requireRole(can.stock);
  const { error } = await searchParams;
  return (
    <>
      <div className="bar"><h2>مادة جديدة</h2></div>
      <Alert error={error} />
      <MaterialForm m={null} />
    </>
  );
}
