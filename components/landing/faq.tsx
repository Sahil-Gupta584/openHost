'use client';

import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { SectionHeading } from '@/components/landing/section-heading';

const faqs = [
  {
    q: 'Do I need to know AWS to use OpenHost?',
    a: 'No. You create an IAM role with our one-click CloudFormation template — that is the extent of AWS knowledge required. OpenHost handles all infrastructure provisioning, builds, and deployments automatically.',
  },
  {
    q: 'Where does my code and data actually live?',
    a: 'Everything runs inside your own AWS account. Static assets sit in your S3 buckets, serverless functions run in your Lambda, and traffic flows through your CloudFront distribution. We never store or copy your application data.',
  },
  {
    q: 'How is this cheaper than Vercel?',
    a: 'Vercel charges a platform fee on top of compute, bandwidth, and function execution, plus overage charges on Pro plans. OpenHost charges a flat platform fee — you pay AWS directly for infrastructure at AWS retail prices, which for typical indie workloads runs $15–35/month.',
  },
  {
    q: 'Does it support the full Next.js feature set?',
    a: 'Yes. We use OpenNext to deploy SSR, ISR, API routes, Middleware, Server Actions, Route Handlers, and static export. If it runs on Vercel, it should deploy on OpenHost.',
  },
  {
    q: 'What happens if I want to leave OpenHost?',
    a: 'Since all infrastructure lives in your AWS account, you keep everything. The S3 buckets, Lambda functions, and CloudFront distributions are yours. You can manage them directly via the AWS console or switch to another tool at any time.',
  },
  {
    q: 'How do preview deployments work?',
    a: 'Every pull request automatically gets its own isolated deployment with a unique preview URL. When the PR is merged or closed, the preview environment is torn down so you only pay for active infrastructure.',
  },
  {
    q: 'Is my AWS account access secure?',
    a: 'We use OIDC for authentication, meaning no long-lived access keys. Access is granted via a least-privilege IAM role scoped only to the resources OpenHost manages. You can revoke access at any time by deleting the role.',
  },
];

export function FAQ() {
  const [openItem, setOpenItem] = useState<string | undefined>('item-0');

  return (
    <section className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />

        <Accordion
          type="single"
          collapsible
          value={openItem}
          onValueChange={setOpenItem}
          className="mt-12"
        >
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border-border/60"
            >
              <AccordionTrigger className="text-left text-base hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
