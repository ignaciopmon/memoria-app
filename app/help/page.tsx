// app/help/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Brain, ArrowLeft,
  BookCopy, Folder, Edit, FileInput, Trash2,
  GraduationCap, /* Repeat, */ Shuffle,
  Sparkles, CalendarCheck, Settings, Palette, Keyboard, Info,
  GripVertical, Paintbrush, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Helper component for help items
const HelpItem = ({ icon: Icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) => (
  <div className="flex items-start gap-4">
    <Icon className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
    <div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="text-muted-foreground space-y-3">{children}</div>
    </div>
  </div>
);

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-background">
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
          <Button variant="ghost" asChild className="mb-6 text-sm">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Link>
          </Button>
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold mb-2">Memoria Guide</h1>
            <p className="text-lg text-muted-foreground">
              Everything you need to know to boost your learning.
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="p-6 md:p-8 space-y-8">

              <HelpItem icon={Info} title="What is Spaced Repetition?">
                <p>
                  It's a super effective learning technique. Instead of cramming, you review information at increasing time intervals. Initially, you review frequently, and as you remember better, the time between reviews gets longer.
                </p>
                <p>
                  Memoria automates this for you. It uses a smart algorithm to show you cards just when you're about to forget them, maximizing long-term retention. Study less, remember more!
                </p>
              </HelpItem>

              <HelpItem icon={BookCopy} title="Decks and Cards">
                 <ul className="list-disc space-y-2 pl-5">
                   <li><strong>Decks:</strong> Think of them as digital notebooks where you store your flashcards on a specific topic (e.g., "English Vocabulary B2", "History of Spain").</li>
                   <li><strong>Cards:</strong> These are your flashcards. They have a "Front" (question, term) and a "Back" (answer, definition). You can add text and images to both sides!</li>
                   <li><strong>Creating:</strong> Use the "New Deck" button for decks or "New Card" inside a deck.</li>
                   <li><strong>Editing Cards:</strong> Within a deck, click the pencil icon (<Edit className="inline h-4 w-4"/>) on a card to modify its text or images.</li>
                 </ul>
              </HelpItem>

              <HelpItem icon={Folder} title="Organization: Folders & Editing">
                 <ul className="list-disc space-y-2 pl-5">
                   <li><strong>Folders:</strong> Group related decks (e.g., a "Languages" folder with "English" and "French" decks). Create them from the Dashboard in Edit Mode.</li>
                   <li><strong>Edit Mode:</strong> On the Dashboard, press the "Edit" button. This allows you to:
                      <ul className="list-circle space-y-1 pl-5 mt-2">
                          <li>Drag (<GripVertical className="inline h-4 w-4"/>) decks to move them (even into or out of folders, and to reorder them).</li>
                          <li>Edit (<Edit className="inline h-4 w-4"/>) decks and folders (name and description for decks).</li>
                          <li>Change the color (<Paintbrush className="inline h-4 w-4"/>) of decks and folders for visual identification.</li>
                          <li>Delete (<Trash2 className="inline h-4 w-4"/>) decks or folders (they will be moved to the Trash).</li>
                      </ul>
                   </li>
                 </ul>
              </HelpItem>
              
              <HelpItem icon={FileInput} title="Importing Content">
                <p>
                  Already have cards in another format? Import them easily! Inside a deck, use the "Import" button to upload files:
                </p>
                 <ul className="list-disc space-y-2 pl-5">
                   <li><strong>CSV:</strong> Comma-separated values file. Select which column is the "Front" and which is the "Back".</li>
                   <li><strong>XLSX (Excel):</strong> Upload your spreadsheet and choose the corresponding columns.</li>
                   <li><strong>TXT:</strong> Plain text file where each line is a card, with the front and back separated by a <kbd>Tab</kbd>.</li>
                 </ul>
              </HelpItem>

              <HelpItem icon={GraduationCap} title="Study Modes">
                 <ul className="list-disc space-y-2 pl-5">
                   <li>
                     <strong>Study (<Play className="inline h-4 w-4"/>):</strong> The core of Memoria. It shows you <span className="font-semibold">only the cards due for review today</span> based on the spaced repetition algorithm. After seeing the answer, rate how well you knew it:
                      <ul className="list-circle space-y-1 pl-5 mt-2">
                          <li><span className="font-semibold text-destructive">Again:</span> You didn't remember. It resets and will be shown again soon.</li>
                          <li><span className="font-semibold text-orange-600">Hard:</span> You struggled to recall. The interval will be shorter.</li>
                          <li><span className="font-semibold text-blue-600">Good:</span> You remembered it well. The interval increases normally.</li>
                          <li><span className="font-semibold text-green-600">Easy:</span> It was very easy. The interval increases significantly.</li>
                      </ul>
                   </li>
                   <li>
                     <strong>Practice:</strong> Review <span className="font-semibold">all cards</span> in a deck in any order you like (even shuffled <Shuffle className="inline h-4 w-4"/>!). Perfect for a quick cram session or an overview before an exam. <span className="italic">This mode does not affect scheduled review times</span>.
                   </li>
                 </ul>
              </HelpItem>
              
               <HelpItem icon={Sparkles} title="Artificial Intelligence (AI) Features">
                 <p>Memoria uses AI to make your studying smarter:</p>
                 <ul className="list-disc space-y-3 pl-5">
                   <li>
                     <strong>Create Deck with AI (<Sparkles className="inline h-4 w-4"/> New AI Deck):</strong> Describe the topic, card type (questions, vocabulary...), quantity, language, and difficulty, and the AI creates the deck for you!
                   </li>
                   <li>
                     <strong>Add Cards with AI (<Sparkles className="inline h-4 w-4"/> Add AI Cards):</strong> Inside a deck, ask the AI to generate more cards on a specific topic. The AI will analyze existing cards to maintain the style and <span className="font-semibold">avoid duplicates</span>.
                   </li>
                    <li>
                     <strong>Generate Test with AI (<Sparkles className="inline h-4 w-4"/> Generate Test):</strong> In each deck, you can ask the AI to create a multiple-choice quiz based on your cards. You can filter by new cards, difficult ones, etc.
                   </li>
                   <li>
                     <strong>AI-Powered Scheduling:</strong> <span className="italic">(Optional, enable in Settings)</span> After taking an AI-generated test, allow the AI to analyze your results and automatically reschedule cards you missed or struggled with, so you review them sooner. AI-rescheduled cards will be marked with a star (<Sparkles className="inline h-4 w-4 text-purple-500"/>) in the "Upcoming" section.
                   </li>
                 </ul>
              </HelpItem>

              <HelpItem icon={CalendarCheck} title="Upcoming Reviews">
                <p>
                  Access this section from the Dashboard menu (or the dropdown menu on mobile). Here you'll see a list of all cards scheduled for future review, ordered by date.
                </p>
                 <ul className="list-disc space-y-2 pl-5">
                   <li>You can see which deck each card belongs to and how long until its review.</li>
                   <li>Cards rescheduled by AI (<Sparkles className="inline h-4 w-4 text-purple-500"/>) will show an explanation on hover.</li>
                   <li>Select cards and use the "Reset" button if you want them to become "new" again and appear in your next study session.</li>
                 </ul>
              </HelpItem>

              <HelpItem icon={Trash2} title="Trash">
                <p>
                  When you delete decks, folders, or cards, they aren't permanently removed immediately. They go to the Trash (accessible from the Dashboard menu).
                </p>
                 <ul className="list-disc space-y-2 pl-5">
                   <li>From the Trash, you can <span className="font-semibold">Restore</span> items to their original location.</li>
                   <li>Or you can <span className="font-semibold text-destructive">Delete Permanently</span> (this action cannot be undone!).</li>
                 </ul>
              </HelpItem>

              <HelpItem icon={Settings} title="Settings">
                 <p>Customize your Memoria experience:</p>
                 <ul className="list-disc space-y-3 pl-5">
                   <li><strong>Study:</strong> Adjust the base intervals (in minutes or days) for the "Again", "Hard", "Good", and "Easy" ratings. Enable or disable the "AI-Powered Scheduling" feature.</li>
                   <li><strong>Shortcuts (<Keyboard className="inline h-4 w-4"/>):</strong> Change the keyboard shortcuts for rating cards in Study Mode and other global shortcuts.</li>
                   <li><strong>Appearance (<Palette className="inline h-4 w-4"/>):</strong> Choose your preferred theme (Light, Dark, Pastel) or let it follow your system settings.</li>
                 </ul>
              </HelpItem>

            </CardContent>
          </Card>
        </div>
      </main>
       <footer className="py-4 text-center text-xs text-muted-foreground">
         Memoria App - Learn Smarter.
       </footer>
    </div>
  );
}