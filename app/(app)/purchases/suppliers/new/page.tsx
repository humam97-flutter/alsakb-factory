import { Alert, type PageProps } from "@/components/ui";
import { SupplierForm } from "../supplier-form";

export default async function NewSupplierPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  return (
    <>
      <div className="bar"><h2>مورد جديد</h2></div>
      <Alert error={error} />
      <SupplierForm s={null} />
    </>
  );
}
