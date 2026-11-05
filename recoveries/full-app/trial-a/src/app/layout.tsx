import type {ReactNode} from "react";
import './globals.css';
export const metadata = {title: 'Dispatch Lab | Route and fleet planning', description: 'A dispatch planning lab with constrained routing, fleet allocation, replanning and transactional dispatch.', robots: {index: false, follow: false}};
export default function Layout({children}:{children:ReactNode}) {return <html lang="en"><body><a className="skip" href="#main-content">Skip to content</a>{children}</body></html>;}
