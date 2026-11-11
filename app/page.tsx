import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SiteScripts } from '@/components/site-scripts';

// El marcado de la landing vive en content/landing.html (sale del prototipo aprobado) y se sirve estático.
const markup = readFileSync(path.join(process.cwd(), 'content', 'landing.html'), 'utf8');

export default function Home() {
  return (
    <>
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: markup }} />
      <SiteScripts />
    </>
  );
}
