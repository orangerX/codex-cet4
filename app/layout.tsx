import type { Metadata } from 'next';
import './globals.css';
import './card-word-size.css';
export const metadata: Metadata = { title: '词间 · 四级高频词卡片', description: '320 个四级常考词，翻卡学习、语音朗读与本机进度记录。每天一组，逐步积累。' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body>{children}</body></html>;}
