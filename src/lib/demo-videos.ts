/**
 * The walkthrough video for each tool, linked from the top of its page.
 *
 * Make anything has none yet; a tool missing from here simply shows no link.
 */
export type DemoTool = "digital" | "print" | "devices" | "popkit" | "thread";

export const DEMO_VIDEOS: Partial<Record<DemoTool, { url: string; label: string }>> = {
  digital: {
    url: "https://drive.google.com/file/d/1L8GA2hNHcoI9Fq4kTrcL9AoxdRQaK1yv/view?usp=drive_link",
    label: "Digital Card",
  },
  print: {
    url: "https://drive.google.com/file/d/1UYFSS1tD1BwZ_zbbMWJeV9K1qCJLsfhE/view?usp=drive_link",
    label: "Printed Card",
  },
  devices: {
    url: "https://drive.google.com/file/d/1bwzvX5pqxGWQ03393nuxXTxOzdXeBIxY/view?usp=drive_link",
    label: "Device Shots",
  },
  popkit: {
    url: "https://drive.google.com/file/d/1j4UjRuMyYwNK5xAT6ibgvaBAKvGoPUPU/view?usp=drive_link",
    label: "PopKit",
  },
  thread: {
    url: "https://drive.google.com/file/d/1i6zBdYIL7yv6TvwxyvUlE200G6F0m4Ko/view?usp=drive_link",
    label: "Thread",
  },
};
