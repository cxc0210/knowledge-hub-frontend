import { DocumentTable } from "@/components/document-table";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const documentTabs = [
  { value: "mine", label: "我的文档" },
  { value: "published", label: "已发布文档" },
  { value: "approval", label: "文档审批" },
];

export default function DocumentPage() {
  return (
    <section
      data-document-page
      className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-col overflow-hidden"
    >
      <header className="shrink-0 pb-5 sm:pb-6">
        <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
          Document
        </h1>
      </header>

      <Tabs defaultValue="mine" className="min-h-0 flex-1">
        <TabsList className="shrink-0" aria-label="文档分类">
          {documentTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="mine" className="min-h-0 flex-1">
          <DocumentTable />
        </TabsContent>

        {documentTabs.slice(1).map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="min-h-0 flex-1"
          >
            <Card className="h-full min-h-80 justify-center rounded-2xl py-0 ring-border sm:rounded-[20px]">
              <CardContent className="grid place-items-center px-5 py-12 text-center">
                <p className="text-xl font-bold tracking-[-0.025em]">{tab.label}</p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
