import { resolve, URL } from "url";
import { queue } from "async";
import { fetchPage, Page, FetchPageOptions, Session } from "./fetch-page";
export { Page, FetchPageOptions } from "./fetch-page";
export type PageVisitorResult = void | boolean | PageVisitor | Promise<boolean | PageVisitor>;
const debug = require("debug")("spider");

class WrappedPageVisitor {
    public beforeLoad: (url: URL) => Promise<WrappedPageVisitor | null>;
    public visit: (page: Page) => Promise<WrappedPageVisitor | null>;
    public leave: (page: Page) => Promise<void>;

    constructor(visitor: Partial<PageVisitor>) {
        const defaultVisitor: WrappedPageVisitor = this;
        function wrapPageVisitorResult<T>
            (unwrapped: (param: T) => PageVisitorResult): 
            (param: T) => Promise<WrappedPageVisitor | null> {
            return (param) => {
                let result: PageVisitorResult;
                try {
                    result = unwrapped(param);
                } catch(err) {
                    return Promise.reject(err);
                }
                if(false === result) {
                    return Promise.resolve(null);
                }
                if(result && (result as any)["then"]) {
                    return (result as Promise<any>).then(r => typeof r === "object" ? r : defaultVisitor);
                }
                return Promise.resolve(typeof result === "object" ? new WrappedPageVisitor(result as PageVisitor) : defaultVisitor);
            };
        }
        
        let vis: PageVisitor = Object.assign({}, {
            beforeLoad() {},
            leave() {},
            visit() {}
        } as PageVisitor, visitor);
        this.beforeLoad = wrapPageVisitorResult<URL>(vis.beforeLoad);
        this.visit = wrapPageVisitorResult<Page>(vis.visit);
        this.leave = async (page) => {
            let result = vis.leave(page);
            if(result) {
                await result
            }
        };
    }
}

export interface PageVisitor {
    beforeLoad(url: URL): PageVisitorResult;
    visit(page: Page): PageVisitorResult;
    leave(page: Page): void | Promise<void>;
}

export type DownloadFunction = (url: URL) => Promise<Page>;

function fetchDownloadFunction(session: boolean, opts?: Partial<FetchPageOptions>): DownloadFunction {
    if(session) {
        let session: Session = new Session();
        return (url: URL) => session.fetchPage(url.toString(), opts);
    }
    return (url: URL) => fetchPage(url.toString(), opts);
}
    
function asyncDownloadQueue(rawDownloadFunction: DownloadFunction, concurrency?: number): DownloadFunction {
    interface FetchTask {
        url: URL;
        onComplete: (page: Page) => void;
        onError: (error: Error) => void;
    }
    let q = queue<FetchTask>((task, cb) => {
        rawDownloadFunction(task.url)
        .then(page => {
            cb();
            task.onComplete(page);
        }).catch(err => {
            cb();
            task.onError(err);
        });
    }, concurrency || 1);
    return (url: URL) => new Promise((res, rej) => q.push({
        url,
        onComplete: res,
        onError: rej,
    }));
}

export interface SpiderExtendedOptions extends FetchPageOptions {
    parallelConnections: number;
    downloadFunction: DownloadFunction;
    maxUrlSize: number;
    session: boolean;
}

export type SpiderOptions = DownloadFunction |  Partial<SpiderExtendedOptions>;

export class Spider {
    private done: Set<string> = new Set();
    private maxUrlSize: number;
    private download: DownloadFunction;

    constructor(opts?: SpiderOptions) {
        if(typeof opts === "function") {
            this.download = opts;
            this.maxUrlSize = 128;
        } else {
            opts = opts || {};
            this.download = opts.downloadFunction
             || asyncDownloadQueue(fetchDownloadFunction(!!opts.session, opts), opts.parallelConnections);
            this.maxUrlSize = opts.maxUrlSize || 128;
        }
    }

    public static makeCleanUrl(url: URL | string): URL {
        let parsedUrl: URL = typeof url === "string" ? new URL(url) : url;
        parsedUrl.hash = "";
        parsedUrl.pathname = parsedUrl.pathname.endsWith("/")
            ? parsedUrl.pathname.substring(0, parsedUrl.pathname.length - 1)
            : parsedUrl.pathname;
        return parsedUrl;
    }

    public static makeUrlUnique(url: URL): string {
        return url.toString().substring(url.protocol.length).trim();
    }

    public static findLinks(page: Page): Set<string> {
        let set: Set<string> = new Set();
        page.$("a").each((_, a) => {
            let link = a.attribs.href;
            if(link) {
                set.add(resolve(page.url.toString(), link));
            }
        });
        return set;
    }

    private async processUrl(url: URL, visitor: WrappedPageVisitor) {
        let withoutProtocol = Spider.makeUrlUnique(url);
        if(this.done.has(withoutProtocol)) {
            return;
        }
        this.done.add(withoutProtocol);
        let visitorResult = await visitor.beforeLoad(url);
        if(!visitorResult) {
            return;
        }
        debug("Fetching", url.toString())
        let page: Page = await this.download(url);
        debug("Visiting", url.toString())
        let childVisitor = await visitor.visit(page);
        if(childVisitor) {
            let children: Promise<void>[] = [];
            for(let link of Spider.findLinks(page).values()) {
                let childUrl = Spider.makeCleanUrl(link);
                if(childUrl.toString().length > this.maxUrlSize) {
                    continue;
                }
                if(childUrl.protocol != "http:" && childUrl.protocol != "https:") {
                    continue;
                }
                children.push(this.processUrl(childUrl, childVisitor).catch(err => {
                    console.log(`Error ${childUrl.toString()} ${err.toString()}`)
                }));
            }
            await Promise.all(children);
        }
        debug("Leaving", url.toString())
        await visitor.leave(page);
    }

    public async visit(url: URL | string, visitor: Partial<PageVisitor>) {
        this.done.clear();
        await this.processUrl(Spider.makeCleanUrl(url), new WrappedPageVisitor(visitor));
    }
}
