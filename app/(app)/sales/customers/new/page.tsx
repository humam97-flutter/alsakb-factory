import { Alert, type PageProps } from "@/components/ui";
import { CustomerForm } from "../customer-form";

export default async function NewCustomerPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  return (
    <>
      <div className="bar"><h2>زبون جديد</h2></div>
      <Alert error={error} />
      <CustomerForm c={null} />
    </>
  );
}
