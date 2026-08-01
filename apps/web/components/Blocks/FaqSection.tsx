import {
  BotIcon,
  GitPullRequestIcon,
  LockIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ZapIcon,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FaqSection() {
  const items = [
    {
      icon: BotIcon,
      title: "What is MergeGuard?",
      content:
        "MergeGuard is an AI-powered code review platform that integrates directly with GitHub. It automatically reviews every pull request for bugs, security vulnerabilities, performance issues, and code quality violations before they are merged. Think of it as an intelligent teammate that never misses a detail.",
    },
    {
      icon: GitPullRequestIcon,
      title: "How does MergeGuard review my pull requests?",
      content:
        "When a pull request is opened, MergeGuard analyzes the changed files, retrieves relevant context from your codebase, and generates a comprehensive review. It publishes inline comments directly on your GitHub pull request with specific, actionable feedback — including suggested fixes where possible.",
    },
    {
      icon: SettingsIcon,
      title: "How long does it take to set up?",
      content:
        "Minutes. Install the MergeGuard GitHub App, select the repositories you want to monitor, and you're done. Every new pull request in those repositories will be automatically reviewed. No configuration files, no CI pipeline changes, no complex setup.",
    },
    {
      icon: ShieldCheckIcon,
      title: "Can MergeGuard detect security vulnerabilities?",
      content:
        "Yes. MergeGuard identifies secret leaks, unsafe API usage, authentication and authorization issues, vulnerable dependencies, and other security concerns. Each finding includes an explanation of the risk and a suggested fix.",
    },
    {
      icon: LockIcon,
      title: "Is my code safe with MergeGuard?",
      content:
        "Absolutely. Your code is encrypted in transit and at rest. MergeGuard does not store your source code — only review results and metadata. We never train on your code, and you can delete your data at any time. Enterprise-grade security is built into everything we do.",
    },
    {
      icon: ZapIcon,
      title: "Does MergeGuard replace human code reviews?",
      content:
        "No. MergeGuard is designed to assist human reviewers, not replace them. It handles the repetitive and time-consuming aspects of code review — catching common issues, enforcing best practices, and checking for vulnerabilities — so human reviewers can focus on architecture, design, and business logic.",
    },
  ];
  return (
    <div id="faq" className="py-24 sm:py-32">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold mb-4 text-neutral-800 dark:text-neutral-100">
          Frequently Asked Questions
        </h2>
        <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto">
          Everything you need to know about MergeGuard and how it can transform
          your code review process.
        </p>
      </div>
      <Accordion className="max-w-4xl mx-auto" defaultValue={["item-1"]}>
        {items.map((item, index) => (
          <AccordionItem key={index} value={`item-${index + 1}`}>
            <AccordionTrigger className="py-4 **:data-[slot=accordion-trigger-icon]:hidden">
              <span className="flex items-center gap-4">
                <item.icon className="size-4 shrink-0" />
                <span>{item.title}</span>
              </span>
              <PlusIcon className="text-muted-foreground pointer-events-none ml-auto size-4 shrink-0 transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-45" />
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {item.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function PlusIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
