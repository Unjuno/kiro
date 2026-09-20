import "./globals.css";

export const metadata = {
  title: "KIRO — Voice-native branching stories",
  description:
    "Branching public-domain and openly licensed stories, playable in the browser or through a live voice agent."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
