import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Neural Network Playground",
	description:
		"Interactive in-browser neural network training on real image datasets. Build, train, and visualize custom networks on MNIST, Fashion-MNIST, and CIFAR-10.",
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
