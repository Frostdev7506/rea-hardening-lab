import type {ReactNode} from "react";
import './globals.css';
export const metadata = {title: 'DispatchLab — Delivery planning', description: 'Plan a fleet, change the constraints, and see which shipments still make it.'};
export default function Layout({children}:{children:ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
