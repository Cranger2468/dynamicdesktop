import { createFileRoute } from '@tanstack/react-router';
import { IslandExperience } from '@/components/island-experience';
export const Route = createFileRoute('/')({
 head: () => ({ meta: [{title:'Island — Your macOS companion'},{name:'description',content:'A quiet, interactive Dynamic Island companion for your Mac. Control media, timers, notifications and desktop preferences.'},{property:'og:title',content:'Island — Your macOS companion'},{property:'og:description',content:'The right things, right at the top. An interactive island for your Mac.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}] }),
 component: IslandExperience,
});
