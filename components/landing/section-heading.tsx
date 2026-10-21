import { Reveal } from '@/components/landing/reveal';

/**
 * Consistent, minimalist section intro: pill eyebrow + title + description.
 * Replaces the ad-hoc uppercase text used across landing sections.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-balance font-display text-3xl font-normal leading-[1.1] tracking-[-0.02em] sm:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-balance text-muted-foreground">{description}</p>
      ) : null}
    </Reveal>
  );
}
