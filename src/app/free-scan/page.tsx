import { QrGuide } from "@/components/scan/qr-guide";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Your free skin scan at NEA, Calgary",
  description: "A free skin scan with our 8-light skin camera. 15 seconds, nothing touches your skin. See your skin score, skin age, hidden sun damage and your top 3 things to fix. Book online.",
  path: "/free-scan",
});

/** Where the free-scan poster's QR code lands. */
export default function FreeScanPage() {
  return <QrGuide />;
}
