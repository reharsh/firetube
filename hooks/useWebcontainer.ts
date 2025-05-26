"use client";
import { useState, useEffect } from 'react';
import { WebContainer } from '@webcontainer/api';

let webcontainerInstance: WebContainer | null = null; // Cache instance

export default function useWebcontainer() {
    const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);
    const [isBooted, setIsBooted] = useState(false);
    console.log("useWebcontainer hook initialized",webcontainerInstance);
    useEffect(() => {
        const bootWebContainer = async () => {
            try {
            webcontainerInstance = await WebContainer.boot();
            } catch (error) {
            console.error("Failed to boot WebContainer:", error);
            return;
            }
        };
        bootWebContainer();
    }, []);

    return { webcontainer, isBooted };
}
