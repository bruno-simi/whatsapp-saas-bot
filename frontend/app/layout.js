import "./globals.css";

export const metadata = {
  title: "WhatsApp SaaS",
  description: "Painel SaaS multi-tenant",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
