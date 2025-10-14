// app/help/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Brain, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <span className="text-xl font-bold">Memoria</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Link>
          </Button>
          <div className="mb-8">
            <h1 className="text-3xl font-bold">How Memoria Works</h1>
            <p className="text-muted-foreground">
              A complete guide to mastering your studies with spaced repetition.
            </p>
          </div>

          <Card>
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>What is Spaced Repetition?</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <p>
                      Spaced repetition is a learning technique that involves reviewing information at increasing intervals over time. When you first learn something, you review it frequently. As you become more confident, the time between reviews increases.
                    </p>
                    <p>
                      This method takes advantage of the "spacing effect," which shows that we learn more effectively when study sessions are spaced out. Memoria automates this process for you, ensuring you review the right cards at the right time to maximize long-term retention.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger>Dashboard: Your Command Center</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <p>The dashboard is where you'll find all your decks and folders.</p>
                    <ul className="list-disc space-y-2 pl-6">
                      <li><strong>Decks:</strong> These are collections of your flashcards. You can create as many as you need.</li>
                      <li><strong>Folders:</strong> Use folders to group related decks (e.g., a "Biology" folder for "Cells" and "Genetics" decks).</li>
                      <li><strong>Edit Mode:</strong> Click the "Edit" button to rearrange your dashboard. You can drag and drop decks into folders, rename items, change their color, or move them to the trash.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger>Study vs. Practice Mode</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <p>Memoria offers two ways to review your cards:</p>
                    <ul className="list-disc space-y-2 pl-6">
                      <li>
                        <strong>Study Mode:</strong> This is the core of the app. It uses the spaced repetition algorithm to show you only the cards that are due for review. After seeing the answer, you'll rate how well you knew it ("Again", "Hard", "Good", "Easy"), and the app will schedule the next review accordingly.
                      </li>
                      <li>
                        <strong>Practice Mode:</strong> This mode lets you review all the cards in a deck in any order, without affecting their scheduled review times. It's perfect for a quick cram session or a general overview before an exam. You can also shuffle the cards in this mode.
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                  <AccordionTrigger>The Learning Algorithm</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <p>
                      Our algorithm is designed to be smart and adaptive. While you can set your preferred base intervals in the settings, the system makes adjustments based on your performance:
                    </p>
                     <ul className="list-disc space-y-2 pl-6">
                      <li><strong>Forgot a Card ("Again"):</strong> If you mark a card as "Again", its progress is reset, and it will be shown to you again within a few minutes in the same study session.</li>
                      <li><strong>Struggling ("Hard"):</strong> If you mark a card as "Hard" twice in a row, the algorithm will significantly shorten the next review interval to help you reinforce the memory.</li>
                      <li><strong>Mastery ("Good" & "Easy"):</strong> As you consistently rate cards as "Good" or "Easy", the time between reviews will grow exponentially, freeing you up to focus on more challenging material.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="item-5">
                  <AccordionTrigger>Managing Your Content</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <p>Keeping your study space organized is easy:</p>
                     <ul className="list-disc space-y-2 pl-6">
                       <li><strong>Creating Cards:</strong> You can add text and images to both the front and back of your cards.</li>
                       <li><strong>Importing:</strong> Quickly populate your decks by importing cards from CSV, XLSX, or TXT files.</li>
                       <li><strong>Trash:</strong> When you delete a deck or a card, it's moved to the Trash. From there, you can either restore it or delete it permanently.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}