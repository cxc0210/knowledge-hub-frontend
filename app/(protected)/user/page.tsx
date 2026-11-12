import { UserTable } from "@/components/user-table";

export default function UserPage() {
  return (
    <section
      data-user-page
      className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-col overflow-hidden"
    >
      <header className="shrink-0 pb-5 sm:pb-6">
        <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-3xl">User</h1>
      </header>

      <UserTable />
    </section>
  );
}
