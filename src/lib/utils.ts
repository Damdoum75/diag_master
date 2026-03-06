import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}
