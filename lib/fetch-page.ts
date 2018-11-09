import { default as fetch, Request, RequestInit, Response } from "node-fetch"
import { load } from "cheerio"
import { URL } from "url";
import { inspect } from "util";

export interface Page {
    url: URL;
    text: string;
    $: CheerioStatic;
}

export interface CallbackOptions {
    callback: (res: Response) => void;
}

export type FetchPageOptions = RequestInit & CallbackOptions;

export async function fetchPage(url: string | Request, init?: Partial<FetchPageOptions>): Promise<Page> {
    let response = await fetch(url, init);
    if(init && init.callback) {
        init.callback(response);
    }
    let contentType = response.headers.get("content-type") || "application/octet-stream";
    let index = contentType.indexOf(";");
    if(index != -1) {
        contentType = contentType.substring(0, index);
    }
    if("text/html" !== contentType) {
        throw new Error(`Content-Type is not text/html (=${contentType})`);
    }
    let text = await response.text();
    let $ = load(text);
    return {
        url: new URL(response.url),
        $,
        text,
    } as Page;
}

export class Session {
    public cookies: Map<string, string> = new Map();

    private callback(r: Response): void {
        let setCookie: string | undefined = r.headers.get("set-cookie") as any;
        if(setCookie) {
            for(let ch of setCookie.split(",")) {
                let i = ch.indexOf(";");
                ch = ch.substring(0, i);
                let pair = ch.split("=");
                this.cookies.set(decodeURIComponent(pair[0].trim()), decodeURIComponent(pair[1]));
            }
        }
    }

    public async fetchPage(url: string | Request, init?: Partial<FetchPageOptions>): Promise<Page> {
        let ini = Object.assign({}, {
            headers: {},
            callback: (r: Response) => this.callback(r),
        }, init);
        let cookie: string | undefined = undefined;
        this.cookies.forEach((v,k) => {
            if(cookie) {
                cookie += "; " + encodeURIComponent(k) + "=" + encodeURIComponent(v);
            } else {
                cookie = encodeURIComponent(k) + "=" + encodeURIComponent(v);
            }
        });
        if(cookie) {
            (ini.headers as any)["cookie"] = cookie;
        }
        return fetchPage(url, ini);
    }
}
