/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable import/no-default-export */

declare module 'curlconverter' {
	export interface CurlJson {
		url?: string;
		raw_url?: string;
		method: string;
		headers: {
			[key: string]: string;
		};
		data: {
			[key: string]: string;
		};
	}

	export function toJsonString(data: string): string;
}

