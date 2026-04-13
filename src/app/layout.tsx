import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	metadataBase: new URL("https://neural-network-playground.vercel.app"),
	title: "Neural Network Playground",
	description:
		"Train CNNs and dense networks in your browser. Watch weights, activations, and loss update in real time.",
	openGraph: {
		title: "Neural Network Playground",
		description: "Train CNNs and dense networks in your browser.",
		url: "https://neural-network-playground.vercel.app",
		siteName: "Neural Network Playground",
		images: [{ url: "/og-image.png", width: 1200, height: 630 }],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Neural Network Playground",
		description: "Train CNNs and dense networks in your browser.",
		images: ["/og-image.png"],
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
