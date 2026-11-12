import { SearchPanel } from "@/components/search-panel";

export default function SearchPage() {
  return (
    <section className="mx-auto w-full max-w-[980px]">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
          搜索
        </h1>
      </header>

      <SearchPanel />
    </section>
  );
}
