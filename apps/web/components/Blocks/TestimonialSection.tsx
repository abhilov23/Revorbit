import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Marquee } from "@/components/ui/marquee"

import { cn } from "@/lib/utils"

const reviews = [
    {
        name: "Sarah Chen",
        username: "@sarahchen",
        body: "MergeGuard cut our code review time in half. The AI catches issues our human reviewers would have missed, and the inline GitHub comments make it effortless to address.",
        img: "https://notion-avatars.netlify.app/api/avatar?preset=female-1",
    },
    {
        name: "Marcus Johnson",
        username: "@marcusj",
        body: "We've reduced production bugs by 40% since adding MergeGuard to our workflow. The security analysis alone has saved us from several critical vulnerabilities.",
        img: "https://notion-avatars.netlify.app/api/avatar/?face=1&nose=10&mouth=8&eyes=11&eyebrows=1&glasses=14&hair=40&accessories=0&details=0&beard=0&halloween=0&christmas=0",
    },
    {
        name: "Emily Rodriguez",
        username: "@emilyrodriguez",
        body: "Setup was incredibly simple. Within minutes, MergeGuard was reviewing our PRs and providing actionable feedback. It's become an indispensable part of our CI pipeline.",
        img: "https://notion-avatars.netlify.app/api/avatar/?face=13&nose=7&mouth=11&eyes=3&eyebrows=12&glasses=3&hair=40&accessories=0&details=0&beard=0&halloween=0&christmas=0",
    },
    {
        name: "David Kim",
        username: "@davidkim",
        body: "The context-aware analysis is a game-changer. MergeGuard doesn't just review files in isolation — it understands how changes fit into our entire codebase.",
        img: "https://notion-avatars.netlify.app/api/avatar/?face=9&nose=3&mouth=7&eyes=10&eyebrows=12&glasses=1&hair=35&accessories=0&details=0&beard=0&halloween=0&christmas=0",
    },
    {
        name: "Priya Patel",
        username: "@priyapatel",
        body: "Our team ships 2x faster now. MergeGuard handles the initial review pass, and our senior engineers only need to review the AI's findings plus the architectural decisions.",
        img: "https://notion-avatars.netlify.app/api/avatar/?face=8&nose=7&mouth=4&eyes=0&eyebrows=6&glasses=11&hair=19&accessories=0&details=0&beard=0&halloween=0&christmas=0",
    },
    {
        name: "Alex Thompson",
        username: "@alexthompson",
        body: "The analytics dashboard gives us incredible visibility into our code quality trends. We can track which issues keep appearing and proactively improve our development practices.",
        img: "https://notion-avatars.netlify.app/api/avatar/?face=1&nose=1&mouth=1&eyes=1&eyebrows=1&glasses=1&hair=1&accessories=1&details=1&beard=1&halloween=1&christmas=1",
    },
]

const firstRow = reviews.slice(0, reviews.length / 2)
const secondRow = reviews.slice(reviews.length / 2)

const ReviewCard = ({
    img,
    name,
    username,
    body,
}: {
    img: string
    name: string
    username: string
    body: string
}) => {
    return (
        <figure
            className={cn(
                "relative h-full w-64 cursor-pointer overflow-hidden rounded-xl border p-4",
                "border-gray-950/10 bg-muted/40",
                "dark:border-gray-50/10 dark:bg-gray-50/10"
            )}
        >
            <div className="flex flex-row items-center gap-2">
                <Avatar className="bg-muted size-12 shrink-0">
                    <AvatarImage
                        alt={name}
                        src={img}
                        loading="lazy"
                        width="120"
                        height="120"
                    />
                    <AvatarFallback>
                        {name
                            .split(' ')
                            .map(n => n[0])
                            .join('')}
                    </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <figcaption className="text-sm font-medium dark:text-white">
                        {name}
                    </figcaption>
                    <p className="text-xs font-medium dark:text-white/40">{username}</p>
                </div>
            </div>
            <blockquote className="mt-2 text-sm">{body}</blockquote>
        </figure>
    )
}

export function TestimonialSection() {
    return (
        <div id="testimonials" className="max-w-7xl mx-auto py-24 sm:py-32">
            <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 text-neutral-800 dark:text-neutral-100">
                    What Our Customers Say
                </h2>
                <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto">
                    Join engineering teams that have transformed their code review process with MergeGuard.
                    Here&apos;s what they have to say.
                </p>
            </div>
            <div className="relative flex w-full flex-col items-center justify-center overflow-hidden gap-2">
                <Marquee pauseOnHover className="[--duration:20s]">
                    {firstRow.map((review) => (
                        <ReviewCard key={review.username} {...review} />
                    ))}
                </Marquee>
                <Marquee reverse pauseOnHover className="[--duration:20s]">
                    {secondRow.map((review) => (
                        <ReviewCard key={review.username} {...review} />
                    ))}
                </Marquee>
                <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-linear-to-r"></div>
                <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-linear-to-l"></div>
            </div>
        </div>
    )
}
