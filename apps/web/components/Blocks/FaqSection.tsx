import Link from "next/link";
import {
  Bot,
  GitPullRequest,
  Github,
  History,
  Settings2,
  UserRound,
} from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const items = [
  {
    icon: Bot,
    title: "What is Revorbit?",
    content:
      "Revorbit is a GitHub App that runs AI-assisted code reviews on pull requests in repositories you connect.",
  },
  {
    icon: GitPullRequest,
    title: "When does a review run?",
    content:
      "Revorbit processes pull requests when they are opened or updated. The repository must be connected and automatic reviews must be enabled.",
  },
  {
    icon: Github,
    title: "How do I connect a repository?",
    content:
      "Create an account, install the Revorbit GitHub App for a personal account or organization, then connect repositories the installation can access.",
  },
  {
    icon: Settings2,
    title: "What can I configure?",
    content:
      "For each connected repository, you can enable or pause automatic reviews, choose the AI model, and set the maximum number of changed files processed per review.",
  },
  {
    icon: History,
    title: "Where can I see review results?",
    content:
      "Revorbit posts review comments on the GitHub pull request. You can also browse recent reviews, summaries, findings, and suggested fixes in your Revorbit dashboard.",
  },
  {
    icon: UserRound,
    title: "Does Revorbit replace human review?",
    content:
      "No. Revorbit provides an additional review pass and suggested fixes. Your team remains responsible for evaluating findings and deciding what to merge.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mb-12 text-center">
        <p className="text-sm font-semibold text-muted-foreground">Common questions</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">
          How Revorbit works
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400">
          A straightforward GitHub workflow, with controls for each connected repository.
        </p>
      </div>
      <Accordion className="mx-auto max-w-3xl" defaultValue={["item-1"]}>
        {items.map((item, index) => (
          <AccordionItem key={item.title} value={`item-${index + 1}`}>
            <AccordionTrigger className="py-5 **:data-[slot=accordion-trigger-icon]:hidden">
              <span className="flex items-center gap-4 text-left">
                <item.icon className="size-4 shrink-0" />
                <span>{item.title}</span>
              </span>
              <span aria-hidden="true" className="ml-auto text-muted-foreground">+</span>
            </AccordionTrigger>
            <AccordionContent className="pl-8 text-sm leading-6 text-muted-foreground">
              {item.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center sm:flex-row">
        <p className="text-sm text-muted-foreground">Ready to try Revorbit on a repository?</p>
        <Button size="sm" variant="outline" render={<Link href="/signup" />}>Create an account</Button>
      </div>
    </section>
  );
}
