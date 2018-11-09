import { default as express, Application } from "express"
import {
    assert,
    should,
} from "chai";
import { Spider } from "../lib/spider";
import { Server } from "http";
import { URL } from "url";

export const server: Promise<Server> = new Promise((res, rej) => {
    let serv: Server = express()
    // ========================
    .get("/page1", (req, res) => {
        res.contentType("text/html");
        res.end(`<html><head><title>Page1</title></head><body>
        <a href="mailto:someone@somewhere.com">Email</a>
        <a href="sftp://somewhere.com/download.pdf">SFTP</a>
        <a href="loooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooong">SFTP</a>
        <a href="page2">Page2</a>
        <a href="/page3">Page3</a>
        <a href="//localhost:9999/page4">Page4</a>
        </body></html>`);
    })
    .get("/page2", (req, res) => {
        res.contentType("text/html");
        res.end(`<html><head><title>Page2</title></head><body>
        <a href="/page3#subsection">Page3</a>
        <a href="/page3/?prop1=value1&prop2=value2">Page3</a>
        </body></html>`);
    })
    .get("/page3", (req, res) => {
        res.contentType("text/html");
        if("value1" === req.query["prop1"]) {
            res.end(`<html><head><title>Page3</title></head><body>
            <a href="/page5/">Page5</a>
            </body></html>`);
        } else {
            res.end(`<html><head><title>Page3</title></head><body>
            <a href="/page6">Page6</a>
            </body></html>`);
        }
    })
    .get("/page4", (req, res) => {
        res.contentType("text/html");
        res.end(`<html><head><title>Page4</title></head><body>
        </body></html>`);
    })
    .get("/page5", (req, res) => {
        res.contentType("text/html");
        res.end(`<html><head><title>Page5</title></head><body>
        </body></html>`);
    })
    .get("/page6", (req, res) => {
        res.contentType("text/html");
        res.end(`<html><head><title>Page5</title></head><body>
        </body></html>`);
    })
    // ========================
    .get("/filter-test/page1", (req, res) => {
        res.contentType("text/html");
        res.end(`<html><head><title>Page1</title></head><body>
        <a href="page2">Page2</a>
        </body></html>`);
    })
    .get("/filter-test/page2", (req, res) => {
        res.contentType("text/html");
        res.end(`<html><head><title>Page2</title></head><body>
        <a href="page3">Page3</a>
        </body></html>`);
    })
    .get("/filter-test/page3", (req, res) => {
        res.contentType("text/html");
        res.end(`<html><head><title>Page3</title></head><body>
        </body></html>`);
    })
    // ========================
    .listen(9999, () => {
        res(serv)
    })
});

describe("Spider", function () {
    it("should visit all pages once", async () => {
        let visited = new Set();
        let expectedSet = new Set();
        expectedSet.add("http://localhost:9999/page1");
        expectedSet.add("http://localhost:9999/page2");
        expectedSet.add("http://localhost:9999/page3");
        expectedSet.add("http://localhost:9999/page3?prop1=value1&prop2=value2");
        expectedSet.add("http://localhost:9999/page4");
        expectedSet.add("http://localhost:9999/page5");
        expectedSet.add("http://localhost:9999/page6");

        await new Spider().visit("http://localhost:9999/page1", {
            visit(page) {
                visited.add(page.url.toString());
            },
        });
        assert.equal(visited.size, expectedSet.size);
        for(let exp of expectedSet) {
            assert.isTrue(visited.has(exp));
        }
    });
    it("should only non-filtered pages", async () => {
        let visited = new Set();
        let expectedSet = new Set();
        expectedSet.add("http://localhost:9999/filter-test/page1");

        await new Spider({
            session: true,
        }).visit(new URL("http://localhost:9999/filter-test/page1"), {
            visit(page) {
                visited.add(page.url.toString());
            },
            beforeLoad(url) {
                if(url.href.indexOf("2") !== -1) {
                    return false;
                }
            },
        });
        assert.equal(visited.size, expectedSet.size);
        for(let exp of expectedSet) {
            assert.isTrue(visited.has(exp));
        }
    })
}).beforeAll(async () => {
    await server;
}).afterAll(async () => {
    (await server).close();
});
