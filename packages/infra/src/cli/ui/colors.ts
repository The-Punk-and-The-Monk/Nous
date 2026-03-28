/** Terminal color utilities using ANSI escape codes */

const ESC = "\x1b[";
const RESET = `${ESC}0m`;

export const colors = {
	bold: (s: string) => `${ESC}1m${s}${RESET}`,
	dim: (s: string) => `${ESC}2m${s}${RESET}`,
	italic: (s: string) => `${ESC}3m${s}${RESET}`,
	red: (s: string) => `${ESC}31m${s}${RESET}`,
	green: (s: string) => `${ESC}32m${s}${RESET}`,
	yellow: (s: string) => `${ESC}33m${s}${RESET}`,
	blue: (s: string) => `${ESC}34m${s}${RESET}`,
	magenta: (s: string) => `${ESC}35m${s}${RESET}`,
	cyan: (s: string) => `${ESC}36m${s}${RESET}`,
	gray: (s: string) => `${ESC}90m${s}${RESET}`,
};
