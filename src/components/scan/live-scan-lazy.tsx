"use client";
import dynamic from "next/dynamic";

/** Loads the live face scan only in the browser, after the page is ready, so it never slows the first paint. */
export const LiveScanLazy = dynamic(() => import("./live-scan").then((m) => m.LiveScanHost), { ssr: false });
