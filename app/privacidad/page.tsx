import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import '../legal.css';

export const metadata: Metadata = { title: 'Aviso de privacidad · Graficante', robots: { index: false } };

const html = readFileSync(path.join(process.cwd(), 'content', 'privacidad.html'), 'utf8');

export default function Page() {
  return <main className="legal" dangerouslySetInnerHTML={{ __html: html }} />;
}
