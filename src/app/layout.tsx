import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WB Product Automation',
  description: 'Автоматизация создания карточек товаров для Wildberries',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>
        {children}
      </body>
    </html>
  )
}