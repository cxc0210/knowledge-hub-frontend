import { AIChat } from "@/components/ai-chat";

export default function AskPage() {
  return (
    <section
      data-ask-page
      className="mx-auto flex h-full min-h-0 w-full max-w-[980px] flex-col overflow-hidden"
    >
      <header className="shrink-0 pb-5 sm:pb-6">
        <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
          AI智能问答
        </h1>
      </header>

      <AIChat />
    </section>
  );
}
