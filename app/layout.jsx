import { Space_Grotesk, Bitter } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/react";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

const GITHUB_URL = "https://github.com/oliks/openatpl";
const BUY_ME_A_COFFEE_USERNAME = "openatpl";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "700"],
});

const bodyFont = Bitter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600"],
});

export const metadata = {
  metadataBase: new URL("https://openatpl.io"),
  title: {
    default: "OpenATPL — Free EASA ATPL Question Bank Practice",
    template: "%s | OpenATPL",
  },
  description: "Free open-source EASA ATPL question bank with 12,000+ practice questions across all 13 ATPL(A) subjects. No accounts, no subscriptions — just questions.",
  keywords: [
    "ATPL", "EASA", "ATPL questions", "ATPL practice", "ATPL exam",
    "EASA ATPL", "ECQB", "pilot exam", "airline pilot", "aviation exam",
    "ATPL question bank", "ATPL study", "free ATPL", "ATPL test",
    "air law", "meteorology", "navigation", "principles of flight",
    "mass and balance", "performance", "flight planning",
  ],
  authors: [{ name: "OpenATPL" }],
  creator: "OpenATPL",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: "https://openatpl.io",
  },
  openGraph: {
    title: "OpenATPL — Free EASA ATPL Question Bank",
    description: "Free open-source EASA ATPL question bank with 12,000+ practice questions. No accounts, no subscriptions — just questions.",
    url: "https://openatpl.io",
    siteName: "OpenATPL",
    images: [{ url: "/gitsocial.png", width: 1280, height: 640 }],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenATPL — Free EASA ATPL Question Bank",
    description: "Free open-source EASA ATPL question bank with 12,000+ practice questions.",
    images: ["/gitsocial.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("openatpl-theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.setAttribute("data-theme","dark")}catch(e){}})()`,
          }}
        />
        {CLARITY_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${CLARITY_ID}");`,
            }}
          />
        )}
      </head>
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="topbar-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="topbar-logo-icon" width={28} height={28} />
              OpenATPL
            </Link>
            <nav className="topbar-nav" aria-label="Main">
              <Link href="/" className="topbar-link">
                Tests
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        {children}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          data-name="BMC-Widget"
          data-cfasync="false"
          src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js"
          data-id={BUY_ME_A_COFFEE_USERNAME}
          data-description="Support me on Buy me a coffee!"
          data-message=""
          data-color="#0f7a69"
          data-position="Right"
          data-x_margin="48"
          data-y_margin="48"
        />
        <footer className="site-footer site-footer-compact">
          <p className="site-footer-disclaimer">
            OpenATPL is open source. No warranties or liabilities are provided. Use at your own risk.
            {" "}Contribute via <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>.
          </p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
